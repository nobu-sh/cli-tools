import { readFile, rm, writeFile } from 'node:fs';

export const readFileAsync = async (path: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		readFile(path, 'utf8', (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
};

export const writeFileAsync = async (path: string, data: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		writeFile(path, data, 'utf8', (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
};

export const removeFileAsync = async (path: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		rm(path, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
};
