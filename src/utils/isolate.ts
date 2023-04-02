export type IsolatedResult<T> =
	| {
			error: Error;
			result: undefined;
	  }
	| {
			error: undefined;
			result: T;
	  };

export async function isolate<R, A extends unknown[]>(
	_case: (...args: A) => Promise<R>,
	...args: A
): Promise<IsolatedResult<R>> {
	try {
		return { error: undefined, result: await _case(...args) };
	} catch (error) {
		let err: Error = error as any;
		if (!(err instanceof Error)) err = new Error(err);

		return { error: err, result: undefined };
	}
}

export function isolateSync<R, A extends unknown[]>(_case: (...args: A) => R, ...args: A): IsolatedResult<R> {
	try {
		return { error: undefined, result: _case(...args) };
	} catch (error) {
		let err: Error = error as any;
		if (!(err instanceof Error)) err = new Error(err);

		return { error: err, result: undefined };
	}
}
