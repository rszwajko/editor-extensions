/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Incident, RuleSet } from "@editor-extensions/shared";
import { Immutable } from "immer";
import * as vscode from "vscode";

export class IssuesModel {
  private _onDidChange = new vscode.EventEmitter<
    IncidentTypeItem | FileItem | ReferenceItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  readonly items: IncidentTypeItem[] = [];

  constructor() {}

  findIncidentType(msg: string) {
    return this.items.find((it) => it.msg === msg);
  }
  findFileItem(incidentMsg: string, fileUri: string) {
    return this.findIncidentType(incidentMsg)?.files.find((it) => it.uri === fileUri);
  }

  updateIssues(ruleSets: Immutable<RuleSet[]>) {
    const allIncidents = ruleSets
      .flatMap((r) => Object.values(r.violations ?? {}))
      .flatMap((v) => v?.incidents ?? []);

    const incidentsByMsg = allIncidents
      .map((it): [string, string, Incident] => [it.message, it.uri, it])
      .reduce(
        (acc, [msg, uri, incident]) => {
          if (!acc[msg]) {
            acc[msg] = [];
          }
          acc[msg].push([uri, incident]);
          return acc;
        },
        {} as { [key: string]: [string, Incident][] },
      );
    //{ [msg: string]: { [uri: string]: Incident[] } }
    const flatTree: [string, { [uri: string]: Incident[] }][] = Object.entries(incidentsByMsg).map(
      ([msg, group]) => [
        msg,
        group.reduce(
          (acc, [uri, incident]) => {
            if (!acc[uri]) {
              acc[uri] = [];
            }
            acc[uri].push(incident);
            return acc;
          },
          {} as { [key: string]: Incident[] },
        ),
      ],
    );

    const items = flatTree
      .map(([msg, uri2incident]): [string, [string, Incident[]][]] => [
        msg,
        Object.entries(uri2incident),
      ])
      .map(([msg, tuples]): [string, FileItem[]] => [
        msg,
        tuples.map(
          ([uri, incidents]) =>
            new FileItem(
              uri,
              incidents.map((it) => new ReferenceItem(it, uri, this)),
              msg,
              this,
            ),
        ),
      ])
      .map(([msg, fileItems]) => new IncidentTypeItem(msg, fileItems, this));

    this.items.splice(0, this.items.length);
    this.items.push(...items);
    this._onDidChange.fire(undefined);
  }

  // --- adapter

  get message() {
    if (this.items.length === 0) {
      return vscode.l10n.t("No results.");
    }
    const files = this.items.reduce((prev, cur) => prev + cur.files.length, 0);
    const total = this.items.length;
    if (total === 1 && files === 1) {
      return vscode.l10n.t("{0} result in {1} file", total, files);
    } else if (total === 1) {
      return vscode.l10n.t("{0} result in {1} files", total, files);
    } else if (files === 1) {
      return vscode.l10n.t("{0} results in {1} file", total, files);
    } else {
      return vscode.l10n.t("{0} results in {1} files", total, files);
    }
  }

  location(item: IncidentTypeItem | FileItem | ReferenceItem) {
    if (item instanceof ReferenceItem) {
      return item.location;
    }
    if (item instanceof FileItem) {
      return item.references[0]?.location ?? item.location;
    }
    return undefined;
  }

  remove(item: IncidentTypeItem | FileItem | ReferenceItem) {
    // TODO not implemented
  }
}

export class IssuesTreeDataProvider
  implements vscode.TreeDataProvider<IncidentTypeItem | FileItem | ReferenceItem>
{
  private readonly _listener: vscode.Disposable;
  private readonly _onDidChange = new vscode.EventEmitter<
    IncidentTypeItem | FileItem | ReferenceItem | undefined
  >();

  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly _model: IssuesModel) {
    this._listener = _model.onDidChangeTreeData(() => this._onDidChange.fire(undefined));
  }

  dispose(): void {
    this._onDidChange.dispose();
    this._listener.dispose();
  }

  async getTreeItem(element: IncidentTypeItem | FileItem | ReferenceItem) {
    if (element instanceof FileItem) {
      // files
      const result = new vscode.TreeItem(element.uri);
      result.contextValue = "file-item";
      result.description = true;
      result.iconPath = vscode.ThemeIcon.File;
      result.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return result;
    } else if (element instanceof ReferenceItem) {
      // references
      const { range } = element.location;
      const doc = await element.getDocument();
      const { before, inside, after } = getPreviewChunks(doc, range);

      const label: vscode.TreeItemLabel = {
        label: before + inside + after,
        highlights: [[before.length, before.length + inside.length]],
      };

      const result = new vscode.TreeItem(label);
      result.collapsibleState = vscode.TreeItemCollapsibleState.None;
      result.contextValue = "reference-item";
      result.command = {
        command: "vscode.open",
        title: vscode.l10n.t("Open Reference"),
        arguments: [
          element.location.uri,
          { selection: range.with({ end: range.start }) } satisfies vscode.TextDocumentShowOptions,
        ],
      };
      return result;
    } else {
      // IncidentTypeItem
      const result = new vscode.TreeItem(element.msg);
      result.contextValue = "incident-type-item";
      result.description = true;
      result.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return result;
    }
  }

  async getChildren(element?: IncidentTypeItem | FileItem | ReferenceItem) {
    if (!element) {
      return this._model.items;
    }
    if (element instanceof IncidentTypeItem) {
      return element.files;
    }
    if (element instanceof FileItem) {
      return element.references;
    }
    return undefined;
  }

  getParent(element: IncidentTypeItem | FileItem | ReferenceItem) {
    if (element instanceof IncidentTypeItem) {
      return undefined;
    }
    if (element instanceof FileItem) {
      return element.getParent();
    }
    if (element instanceof ReferenceItem) {
      return element.getParent();
    }
    return undefined;
  }
}

export class IncidentTypeItem {
  constructor(
    readonly msg: string,
    readonly files: Array<FileItem>,
    readonly model: IssuesModel,
  ) {}
}

export class FileItem {
  readonly location: vscode.Location;
  constructor(
    readonly uri: string,
    readonly references: Array<ReferenceItem>,
    readonly incidentMsg: string,
    readonly model: IssuesModel,
  ) {
    this.location = new vscode.Location(vscode.Uri.parse(uri), new vscode.Position(0, 0));
  }

  getParent() {
    return this.model.findIncidentType(this.incidentMsg);
  }
  // --- adapter

  remove(): void {
    // TODO not implemented
  }
}

export class ReferenceItem {
  private _document: Thenable<vscode.TextDocument> | undefined;
  readonly location: vscode.Location;

  constructor(
    readonly incident: Incident,
    readonly fileUri: string,
    readonly model: IssuesModel,
  ) {
    this.location = new vscode.Location(
      vscode.Uri.parse(fileUri),
      new vscode.Position(incident.lineNumber ?? 0, 0),
    );
  }

  async getDocument() {
    if (!this._document) {
      this._document = vscode.workspace.openTextDocument(this.location.uri);
    }
    return this._document;
  }

  getParent() {
    return this.model.findFileItem(this.incident.message, this.fileUri);
  }

  // --- adapter

  remove(): void {
    // TODO not implemented
  }
}

export function getPreviewChunks(
  doc: vscode.TextDocument,
  range: vscode.Range,
  beforeLen: number = 8,
  trim: boolean = true,
) {
  const previewStart = range.start.with({
    character: Math.max(0, range.start.character - beforeLen),
  });
  const wordRange = doc.getWordRangeAtPosition(previewStart);
  let before = doc.getText(
    new vscode.Range(wordRange ? wordRange.start : previewStart, range.start),
  );
  const inside = doc.getText(range);
  const previewEnd = range.end.translate(0, 331);
  let after = doc.getText(new vscode.Range(range.end, previewEnd));
  if (trim) {
    before = before.replace(/^\s*/g, "");
    after = after.replace(/\s*$/g, "");
  }
  return { before, inside, after };
}
