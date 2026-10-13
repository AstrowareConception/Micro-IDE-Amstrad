// Interfaces.ts - Interfaces
// (c) Marco Vieth, 2020
// https://benchmarko.github.io/CPCBasicTS/
//
//

//import { CustomError } from "./Utils";
export interface CustomError extends Error {
	value: string
	pos: number
	len?: number,
	line?: number | string
	hidden?: boolean
	shortMessage?: string
	errCode?: number
}

export type LoadScriptFn = (url: string, fnSuccess: (url2: string, key: string) => void, fnError: (url2: string, key: string) => void, key: string) => void;

export interface IOutput {
    text: string
    error?: CustomError
}

