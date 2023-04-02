import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse, encode } from 'ini';

export const configDirectory = resolve(homedir(), '.nobu', 'cli-tools');
export const configFile = resolve(configDirectory, 'config.ini');

export interface TinifyConfig {
	apiKey: string;
}

export interface Config {
	tinify: TinifyConfig;
}

export const DefaultConfig: Config = {
	tinify: {
		apiKey: '',
	},
};

// if (!existsSync(configDirectory)) {
// 	mkdirSync(configDirectory, { recursive: true });
// }

// if (!existsSync(configFile)) {
// 	writeFileSync(configFile, encode(DefaultConfig, { whitespace: true }));
// }

export const getConfig = (): Config => {
	if (!existsSync(configDirectory)) {
		mkdirSync(configDirectory, { recursive: true });
	}

	if (!existsSync(configFile)) {
		writeFileSync(configFile, encode(DefaultConfig, { whitespace: true }));
	}

	const config = parse(readFileSync(configFile, 'utf8'));
	return config as Config;
};

export const writeConfig = (config: Partial<Config>): Config => {
	const fullConfig = getConfig();
	const newConfig = Object.assign(fullConfig, config);

	writeFileSync(configFile, encode(newConfig, { whitespace: true }));

	return newConfig;
};
