import { ReactNode } from "react";

type DataTableProps = {
  caption: string;
  headers: string[];
  children: ReactNode;
  empty: boolean;
  emptyMessage: string;
};

export function DataTable({ caption, headers, children, empty, emptyMessage }: DataTableProps) {
  return (
    <div className="table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="table-empty-cell">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
