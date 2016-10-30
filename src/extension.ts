'use strict';

import * as vscode from 'vscode';
import * as utils from './utils';

let normalDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions> {
    textDecoration: 'none; opacity: 1'
});

let dimDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions> {
    textDecoration: 'none; opacity: .5'
});

let enabled = false;
let dimSelectedLines = false;
let context = 0;
let opacity = 50;
let delay = 200;
let commandScope = true;

let delayers: { [key: string]: utils.ThrottledDelayer<void> } = Object.create(null);

export function activate(context: vscode.ExtensionContext) {
    let configRegistration = vscode.workspace.onDidChangeConfiguration(readConfiguration);
    let selectionRegistration = vscode.window.onDidChangeTextEditorSelection((e) => updateIfEnabled(e.textEditor));

    let textEditorChangeRegistration = vscode.window.onDidChangeActiveTextEditor((textEditor) => updateIfEnabled(textEditor))

    let commandRegistration = vscode.commands.registerCommand('dimmer.ToggleDimmer', () => {
        vscode.workspace.getConfiguration('dimmer').update("enabled", !enabled, commandScope)
    });

    readConfiguration();

    context.subscriptions.push(selectionRegistration, configRegistration, commandRegistration, textEditorChangeRegistration);
}

function updateIfEnabled(textEditor: vscode.TextEditor) {
    if (enabled) {
        setDecorations(textEditor);
    }
}

function readConfiguration()  {
    resetAllDecorations();
    dimDecoration.dispose();

    let config = vscode.workspace.getConfiguration('dimmer');
    enabled = config.get('enabled', false);
    dimSelectedLines = config.get('dimSelectedLines', false);
    context = config.get('context', 0);
    opacity = config.get('opacity', 50);
    delay = config.get('delay', 200);
    commandScope = config.get('toggleDimmerCommandScope', 'user') === "user";

    dimDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions> {
        textDecoration: `none; opacity: ${opacity / 100}`
    });

    if (enabled) {
        setAllDecorations();
    }
}

function resetAllDecorations() {
    vscode.window.visibleTextEditors.forEach(textEditor => {
        resetDecorations(textEditor);
    });
}

function resetDecorations(textEditor: vscode.TextEditor) {
        highlightSelections(textEditor, []);
        undimEditor(textEditor);
}

function setAllDecorations() {
    vscode.window.visibleTextEditors.forEach(textEditor => {
        setDecorations(textEditor);
    });
}

function setDecorations(textEditor: vscode.TextEditor) {
    let filename = textEditor.document.fileName;
    let delayer = delayers[filename];
    if (!delayer) {
        delayer = new utils.ThrottledDelayer<void>(delay);
        delayers[filename] = delayer;
    }
    delayer.trigger(() => {
        return Promise.resolve().then(() => {
            dimEditor(textEditor);
            highlightSelections(textEditor, textEditor.selections);
            highlightContext(textEditor, textEditor.selection);
        })
    }, delay);
}

function highlightSelections(editor: vscode.TextEditor, selections: vscode.Range[]) {
    let ranges: vscode.Range[] = [];
    selections.forEach(s => {
        if (dimSelectedLines) {
            ranges.push(s);
        }
        else {
            ranges.push(new vscode.Range(
                new vscode.Position(s.start.line, 0),
                new vscode.Position(s.end.line, Number.MAX_VALUE)
            ));
        }
    });

    editor.setDecorations(normalDecoration, ranges);
}

function highlightContext(editor: vscode.TextEditor, selection: vscode.Range) {
    if (context < 0) {
        return;
    }

    let startPosition = selection.start;
    let endPosition = selection.end;

    if (startPosition.isAfter(endPosition)) {
        [startPosition, endPosition] = [endPosition, startPosition];
    }

    startPosition = startPosition.with(Math.max(startPosition.line - context, 0), 0);
    endPosition = endPosition.with(endPosition.line + context, Number.MAX_VALUE);

    editor.setDecorations(normalDecoration, [new vscode.Range(startPosition, endPosition)]);
}

function undimEditor(editor: vscode.TextEditor) {
    editor.setDecorations(dimDecoration, []);
}

function dimEditor(editor: vscode.TextEditor) {
    let startPosition = new vscode.Position(0, 0)
    let endPosition = new vscode.Position(editor.document.lineCount, Number.MAX_VALUE);
    editor.setDecorations(dimDecoration, [new vscode.Range(startPosition, endPosition)]);
}

// this method is called when your extension is deactivated
export function deactivate() {
}