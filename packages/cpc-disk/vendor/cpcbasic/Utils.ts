// @ts-nocheck — minimal upstream utilities; browser/eval utilities deliberately omitted
import type { CustomError } from "./Interfaces.ts";
export class Utils {
static debug = 0; static console = console;
	static stringCapitalize(str: string): string { // capitalize first letter
		return str.charAt(0).toUpperCase() + str.substring(1);
	}
	static toPrecision9(num: number): string {
		const numStr = num.toPrecision(9), // some rounding, formatting
			[decimal, exponent] = numStr.split("e"), // eslint-disable-line array-element-newline
			result = String(Number(decimal)) + (exponent !== undefined ? ("E" + exponent.replace(/(\D)(\d)$/, "$10$2")) : "");

		// Number(): strip trailing decimal point and/or zeros (replace(/\.?0*$/, ""))
		// exponent 1 digit to 2 digits
		return result;
	}
	static isCustomError(e: unknown): e is CustomError {
		return (e as CustomError).pos !== undefined;
	}
	static composeError(name: string, errorObject: Error, message: string, value: string, pos?: number, len?: number, line?: string | number, hidden?: boolean): CustomError {
		const customError = errorObject as CustomError;

		customError.name = name;
		customError.message = message;
		customError.value = value;

		if (pos !== undefined) {
			customError.pos = pos;
		}
		if (len !== undefined) {
			customError.len = len;
		}
		// Safari: Some additional properties are already defined: line, column. Shall we use "cause" property now?
		if (line !== customError.line) {
			customError.line = line;
		}
		if (hidden !== undefined) {
			customError.hidden = hidden;
		}

		let errorLen = customError.len;

		if (errorLen === undefined && customError.value !== undefined) {
			errorLen = String(customError.value).length;
		}

		const endPos = (customError.pos || 0) + (errorLen || 0),
			lineMsg = (customError.line !== undefined ? " in " + customError.line : ""),
			posMsg = pos !== undefined ? (" at pos " + (pos !== endPos ? customError.pos + "-" + endPos : customError.pos)) : "";

		customError.shortMessage = customError.message + (lineMsg || posMsg) + ": " + customError.value;
		customError.message += lineMsg + posMsg + ": " + customError.value;

		return customError;
	}
}
