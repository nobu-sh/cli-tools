// Add shebang later for individual invocation

import { basename } from 'node:path';
import { Command } from 'commander';
import { globSync } from 'glob';
import { optimize } from 'svgo';
import { readFileAsync, removeFileAsync, writeFileAsync } from '../utils';

interface Options {
	ignore?: boolean;
	jsx?: boolean;
	remove?: boolean;
}

const makeDefaultFunctionComponent = (svg: string): string => {
	return `export default () => (\n${svg.replaceAll(/^(?<line>.)/gm, '  $1')});\n`;
};

class ConversionError extends Error {
	public constructor(public file: string, message: string) {
		super(message);
		this.name = 'ConversionError';
	}
}

// Converts string css to object
function CSSstring(string: string): object {
	const css_json = `{"${string
		.replaceAll(/;(?<blank> |)/g, '", "')
		.replaceAll(/:(?<blank> |)/g, '": "')
		.replace(';', '')}"}`;

	const obj = JSON.parse(css_json);

	// Remove unsupported attributes
	delete obj['enable-background'];

	const keyValues = Object.keys(obj).map((key) => {
		const camelCased = key.replaceAll(/-[a-z]/g, (group) => group[1].toUpperCase());
		return { [camelCased]: obj[key] };
	});
	return Object.assign({}, ...keyValues);
}

const makeConversion = async (path: string, options: Options): Promise<string> => {
	try {
		const rawText = await readFileAsync(path);

		// TODO: Find a less hacky way to do this.
		// Optimizes the SVG by removing everything uneeded with the default preset.
		const optimizedSvg = optimize(rawText, {
			multipass: false,
			js2svg: {
				indent: 2,
				pretty: true,
			},
			plugins: [
				{
					name: 'preset-default',
					params: {
						overrides: {
							// viewBox is required to resize SVGs
							// @see https://github.com/svg/svgo/issues/1128
							removeViewBox: false,
							// Removes markers
							// @see https://github.com/svg/svgo/issues/1721
							cleanupIds: false,
						},
					},
				},
			],
		});

		// Converts all attributes and elements incompatible with react to compatible with react.
		// Uses hacky token placeholders that are later replaced with the correct values otherwise svgo
		// will attempt to automatically escape the values to be HTML compatible.
		const reactified = optimize(optimizedSvg.data, {
			multipass: false,
			js2svg: {
				indent: 2,
				pretty: true,
			},
			plugins: [
				{
					name: 'convertStyleToString',
					fn: () => ({
						element: {
							enter(node) {
								if (node.name === 'style' && node.children[0].type === 'text') {
									node.children[0].value = `__STYLE_TAG_OPENING__${node.children[0].value}__STYLE_TAG_CLOSING__`;
								}
							},
						},
					}),
				},
				{
					name: 'reactify',
					fn: () => ({
						element: {
							enter(node) {
								// Remove classes
								if (node.attributes.class) {
									node.attributes.className = node.attributes.class;
									delete node.attributes.class;
								}

								// Update styles to match react
								if (node.attributes.style) {
									node.attributes.style = `__INLINE_STYLE_BEGIN__${JSON.stringify(
										CSSstring(node.attributes.style),
									).replaceAll('"', '__INLINE_QUOTE__')}__INLINE_STYLE_END__`;
								}

								// Fix attributes with colons
								const keysWithColon = Object.keys(node.attributes).filter((key) => key.includes(':'));
								for (const key of keysWithColon) {
									const newKey = key
										.replaceAll(/:(?<key>[1-9a-z])/gi, (group) => group[1].toUpperCase())
										.replaceAll(':', '');
									node.attributes[newKey] = node.attributes[key];
									// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
									delete node.attributes[key];
								}

								// Fix attributes with dashes
								const keysWithDashes = Object.keys(node.attributes).filter((key) => key.includes('-'));
								for (const key of keysWithDashes) {
									const newKey = key
										.replaceAll(/-(?<key>[1-9a-z])/gi, (group) => group[1].toUpperCase())
										.replaceAll('-', '');
									node.attributes[newKey] = node.attributes[key];
									// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
									delete node.attributes[key];
								}
							},
						},
					}),
				},
			],
		});

		// Replace the token placeholders with the correct values.
		const final = reactified.data
			.replaceAll('__STYLE_TAG_OPENING__', '{"')
			.replaceAll('__STYLE_TAG_CLOSING__', '"}')
			.replaceAll('"__INLINE_STYLE_BEGIN__', '{')
			.replaceAll('__INLINE_STYLE_END__"', '}')
			.replaceAll('__INLINE_QUOTE__', '"');

		// Create the React component.
		const component = makeDefaultFunctionComponent(final);

		const componentPath = `${path.slice(0, -4)}${options.jsx ? '.jsx' : '.tsx'}`;
		await writeFileAsync(componentPath, component);

		if (options.remove) {
			await removeFileAsync(path);
		}

		return basename(componentPath);
	} catch (error) {
		throw new ConversionError(path, String(error));
	}
};

const reactSvg = new Command()
	.name('react-svg')
	.description('Convert SVG to React component.')
	.argument('<files...>', 'Array of SVG files to convert. Can be a glob pattern.')
	.option('-r, --remove', 'Remove original SVG files after conversion.')
	.option('-i, --ignore', 'Ignore non SVG files.')
	.option('-j, --jsx', 'Use JSX instead of TSX.')
	.action((globs: string[], options: Options) => {
		// Resolve the globs to absolute paths.
		let resolvedGlobs = globSync(globs, { absolute: true });

		// Find all non SVG files and exit if there are any. If the ignore flag is set, remove them from the list.
		const offendingFiles = resolvedGlobs.filter((glob) => glob.split('.').pop() !== 'svg');
		if (offendingFiles.length > 0 && !options.ignore) {
			console.error(
				`Not all resolved paths are SVGs use the --ignore flag to ignore non SVG files:\n${offendingFiles
					.map((path) => `-  ${path}`)
					.join('\n')}`,
			);
			return;
		} else if (offendingFiles.length > 0) {
			resolvedGlobs = resolvedGlobs.filter((glob) => glob.split('.').pop() === 'svg');
		}

		// If no paths are resolved, exit.
		if (resolvedGlobs.length < 1) {
			console.error('No SVG files found in the provided path(s).');
			return;
		}

		const conversionPromises = resolvedGlobs.map(async (path) => makeConversion(path, options));
		Promise.allSettled(conversionPromises)
			.then((res) => {
				const successfulConversions = res.filter(
					(result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled',
				);
				const failedConversions = res.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

				// Log successful conversions.
				if (successfulConversions.length > 0) {
					console.log(`Converted ${successfulConversions.length} SVG file(s) to React components.`);
					// console.log(`${successfulConversions.map((item) => `-  ${item.value}`).join('\n')}`);
					if (options.remove) {
						console.log('Removed original SVG file(s).');
					}
				}

				// Log failed conversions.
				if (failedConversions.length > 0) {
					console.error(`Failed to convert ${failedConversions.length} SVG file(s) to React components.`);
					console.error(
						`${failedConversions
							.map((item) => `-  ${item.reason.file}\n${String(item.reason).replaceAll(/^(?<line>.)/gm, '   $1')}`)
							.join('\n\n')}`,
					);
				}
			})
			.catch((error) => {
				console.error(error);
				console.error('Failed to convert SVG file(s) to React components.');
			});
	});

export default reactSvg;