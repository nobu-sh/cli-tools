// Add shebang later for individual invocation

import { basename } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { globSync } from 'glob';
import tini from 'tinify';
import { getConfig, writeConfig } from '../config';
import { isolate, readBufferAsync, removeFileAsync, writeBufferAsync } from '../utils';

async function requestAPIKey(): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: stdin,
			output: stdout,
		});
		rl.question('Please enter your tinify API key: ', (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

interface Options {
	ignore?: boolean;
	postfix: string;
	remove?: boolean;
	webp?: boolean;
}

class TinifyError extends Error {
	public constructor(public file: string, message: string) {
		super(message);
		this.name = 'TinifyError';
	}
}

function getFilePathWithoutExtension(path: string): string {
	return path.split('.').slice(0, -1).join('.');
}

function getFileExtension(path: string): string {
	return basename(path).split('.').pop() ?? '';
}

async function minify(path: string, options: Options): Promise<string> {
	try {
		const filePath = getFilePathWithoutExtension(path);
		const fileExtension = options.webp ? 'webp' : getFileExtension(path);

		const rawFile = await readBufferAsync(path);
		const result = await isolate(async () => {
			let source = tini.fromBuffer(rawFile);

			if (options.webp) {
				source = source.convert({ type: 'image/webp' });
			}

			const result = source.result();

			return {
				ext: await result.extension(),
				buf: await result.toBuffer(),
			};
		});

		if (result.error) {
			throw new TinifyError(path, String(result.error));
		}

		if (options.remove) {
			await removeFileAsync(path);
		}

		const newPath = options.remove
			? `${filePath}.${result.result.ext ?? fileExtension}`
			: `${filePath}.${options.postfix}.${result.result.ext ?? fileExtension}`;
		await writeBufferAsync(newPath, result.result.buf);

		return basename(newPath);
	} catch (error) {
		throw new TinifyError(path, String(error));
	}
}

async function tinifyAction(paths: string[], options: Options): Promise<void> {
	let config = getConfig();
	if (config.tinify.apiKey.length < 1) {
		const apiKey = await requestAPIKey();
		tini.key = apiKey;

		// Test API key here
		const validationResult = await isolate(async () => tini.validate());
		if (validationResult.error) {
			console.error('API key is invalid.');
			return;
		}

		console.log('Key is Valid! Caching in home directory...');
		config = writeConfig({ tinify: { apiKey } });
	} else {
		// Test stored API key
		tini.key = config.tinify.apiKey;

		const validationResult = await isolate(async () => tini.validate());
		if (validationResult.error) {
			console.error('API key is invalid.');

			// Reset cached API key
			config = writeConfig({ tinify: { apiKey: '' } });
			return;
		}
	}

	const miniPromises = paths.map(async (path) => minify(path, options));
	const res = await Promise.allSettled(miniPromises);

	const successfulConversions = res.filter(
		(result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled',
	);
	const failedConversions = res.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

	// Log successful conversions.
	if (successfulConversions.length > 0) {
		console.log(`Minified ${options.webp ? 'and converted ' : ''}${successfulConversions.length} file(s).`);
		// console.log(`${successfulConversions.map((item) => `-  ${item.value}`).join('\n')}`);
		if (options.remove) {
			console.log('Removed original unoptimized file(s).');
		}
	}

	// Log failed conversions.
	if (failedConversions.length > 0) {
		console.error(`Failed to minify ${options.webp ? 'and converted ' : ''}${failedConversions.length} file(s).`);
		console.error(
			`${failedConversions
				.map((item) => `-  ${item.reason.file}\n${String(item.reason).replaceAll(/^(?<line>.)/gm, '   $1')}`)
				.join('\n\n')}`,
		);
	}
}

const tinify = new Command()
	.name('tinify')
	.description('Image optimization using tinify')
	.argument('<files...>', 'Array of PNG/WEBP/JPEG files to convert. Can be a glob pattern.')
	.option('-r, --remove', 'Remove original files after conversion.')
	.option('-p, --postfix', 'Postfix to use when --remove is not used.', 'min')
	.option('-i, --ignore', 'Ignore non PNG/WEBP/JPEG files.')
	.option('-w, --webp', 'Convert input files to WEBP.')
	.action((globs: string[], options) => {
		// Resolve the globs to absolute paths.
		let resolvedGlobs = globSync(globs, { absolute: true });

		const fileTypes = ['png', 'webp', 'jpeg'];

		// Find all non SVG files and exit if there are any. If the ignore flag is set, remove them from the list.
		const offendingFiles = resolvedGlobs.filter((glob) => !fileTypes.includes(glob.split('.').pop() ?? ''));
		if (offendingFiles.length > 0 && !options.ignore) {
			console.error(
				`Not all resolved paths are PNG/WEBP/JPEG use the --ignore flag to ignore non PNG/WEBP/JPEG files:\n${offendingFiles
					.map((path) => `-  ${path}`)
					.join('\n')}`,
			);
			return;
		} else if (offendingFiles.length > 0) {
			resolvedGlobs = resolvedGlobs.filter((glob) => fileTypes.includes(glob.split('.').pop() ?? ''));
		}

		// If no paths are resolved, exit.
		if (resolvedGlobs.length < 1) {
			console.error('No PNG/WEBP/JPEG files found in the provided path(s).');
			return;
		}

		tinifyAction(resolvedGlobs, options).catch((error) => {
			console.error(error);
			console.error('Something went wrong while attempting to optimize images.');
		});
	});

export default tinify;
