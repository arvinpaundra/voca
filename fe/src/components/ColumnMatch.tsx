import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { fileCount, MATCH_OPTIONS, readFileHeader, type Header, type Match } from "../lib/columnMatch";
import { Select } from "./Select";
import { cx } from "./cx";

export interface ColumnRow {
  readonly label: string;
  readonly blank: boolean;
  readonly match: Match;
  readonly files: number | null;
}

type ColumnMatchProps = {
  rows: ReadonlyArray<ColumnRow>;
  lines: ReadonlyArray<string>;
  onChoose: (index: number, field: Match) => void;
};

const NOT_IMPORTED = "";

const OPTIONS = MATCH_OPTIONS.map((option) => ({ value: option.value ?? NOT_IMPORTED, label: option.label }));

const valueOf = (match: Match): string => match ?? NOT_IMPORTED;

const choiceOf = (value: string): Match =>
  MATCH_OPTIONS.find((option) => (option.value ?? NOT_IMPORTED) === value)?.value ?? null;

export function ColumnMatch({ rows, lines, onChoose }: ColumnMatchProps) {
  const inFiles = rows.some((row) => row.files !== null);

  return (
    <div className="grid gap-2">
      <p className="cm-title">Match columns</p>

      <div className={cx("cm", inFiles && "multi")}>
        <div className="cm-head">
          <span>Your column</span>
          {inFiles && <span>In</span>}
          <span>Imports as</span>
        </div>

        {rows.map((row, index) => (
          <div key={index} className={cx("cm-row", row.match === null && "off")}>
            <span className={cx("cm-name", row.blank && "blank")}>{row.label}</span>

            {row.files !== null && <span className="cm-in">{fileCount(row.files)}</span>}

            <Select
              label={row.label}
              value={valueOf(row.match)}
              options={OPTIONS}
              onChange={(value) => onChoose(index, choiceOf(value))}
            />
          </div>
        ))}
      </div>

      {lines.map((line) => (
        <p key={line} className="cm-note bad">
          <CircleAlert size={14} aria-hidden="true" />
          <span>{line}</span>
        </p>
      ))}
    </div>
  );
}

export function useFileHeaders(files: ReadonlyArray<File>): ReadonlyMap<File, Header> {
  const [headers, setHeaders] = useState<ReadonlyMap<File, Header>>(() => new Map());

  useEffect(() => {
    let current = true;

    void Promise.all(files.map(async (file) => [file, await readFileHeader(file)] as const)).then((entries) => {
      if (current) setHeaders(new Map(entries));
    });

    return () => {
      current = false;
    };
  }, [files]);

  return headers;
}
