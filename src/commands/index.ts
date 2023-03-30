import { Command } from 'commander';
import img from './img';

const root = new Command().description('A collection of CLI tools').version('0.0.1');

root.addCommand(img);

export function init(scriptName = 'ncli') {
	root.name(scriptName);
	root.parse();
}
