import { Command } from 'commander';

const img = new Command()
	.name('img')
	.description('Mass image maniuplation tools')
	.action(() => {
		console.log('img');
	});

export default img;
