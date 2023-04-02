// Add shebang later for individual invocation

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { globSync } from 'glob';
import tini from 'tinify';
import { getConfig, writeConfig } from '../config';
import { isolate } from '../utils';

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
	prefix: string;
	remove?: boolean;
}

async function tinifyAction(_paths: string[], _options: Options): Promise<void> {
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

	console.log('yes');
}

const tinify = new Command()
	.name('tinify')
	.description('Image optimization using tinify')
	.argument('<files...>', 'Array of PNG/WEBP/JPEG files to convert. Can be a glob pattern.')
	.option('-r, --remove', 'Remove original files after conversion.')
	.option('-p, --prefix', 'Prefix to use when --remove is not used.', 'compressed-')
	.option('-i, --ignore', 'Ignore non PNG/WEBP/JPEG files.')
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
