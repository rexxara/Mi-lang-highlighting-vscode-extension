import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();
interface ApiMap {
	[arg: string]: true
}
const apis = ['showBg', "leaveCh", "showCh", "playBgm", "pauseBgm", "resumeBgm", "removeBg", "showCg", "removeCg", "showChoose", "showInput", "showEffect", "removeEffect", "showSoundEffect"]
let apiMap: ApiMap = {}
apis.map(v => {
	apiMap[v] = true
})
const legend = (function () {
	const tokenTypesLegend = ['keyword', 'variable'];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend: string[] = [];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'mi' }, new DocumentSemanticTokensProvider(), legend));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
	}

	private _encodeTokenType(tokenType: string): number {
		if (apiMap[tokenType]) {
			return tokenTypes.get('keyword')!
		}
		if (tokenType === 'var') {
			return tokenTypes.get('variable')!
		}
		return tokenTypes.size + 2;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let currentOffset = 0;
			do {
				const openOffset = line.indexOf('[', currentOffset);
				if (openOffset === -1) {
					break;
				}
				const closeOffset = line.indexOf(']', openOffset);
				if (closeOffset === -1) {
					break;
				}

				const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
				r.push({
					line: i,
					startCharacter: openOffset + 1,
					length: closeOffset - openOffset - 1,
					tokenType: tokenData.tokenType,
					tokenModifiers: tokenData.tokenModifiers
				});
				currentOffset = closeOffset;
			} while (true);
			let varCurrentOffset = 0;
			do {
				const variableOpenOffset = line.indexOf("${", varCurrentOffset)
				if (variableOpenOffset === -1) {
					break;
				}
				const variableCloseOffset = line.indexOf("}", variableOpenOffset)
				if (variableCloseOffset === -1) {
					break;
				}
				const tokenData = this._parseTextToken(line.substring(variableOpenOffset + 1, variableCloseOffset));
				r.push({
					line: i,
					startCharacter: variableOpenOffset,
					length: (variableCloseOffset - variableOpenOffset) + 1,
					tokenType: 'var',
					tokenModifiers: tokenData.tokenModifiers
				});
				varCurrentOffset = variableCloseOffset;
			} while (true);
		}
		return r;
	}

	private _parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
		const parts = text.split(':');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
}
