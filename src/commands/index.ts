import { Command } from 'commander';
import reactSvg from './react-svg';
import tinify from './tinify';

const root = new Command().description('A collection of CLI tools').version('0.0.1');

root.addCommand(tinify);
root.addCommand(reactSvg);

export function init(scriptName = 'ncli') {
	root.name(scriptName);
	root.parse();
}
