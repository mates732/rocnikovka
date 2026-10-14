import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";

const headers = ["Issue ID", "Entity", "Type", "Description", "Status"];

export function ValidationPage() {
  return (
    <section className="page" aria-labelledby="validation-title">
      <PageHeader
        eyebrow="System"
        title="Validation"
        description="Dataset and linkage validation results. Validation is not run yet — no results are shown until a real run produces them."
        titleId="validation-title"
      />

      <section className="panel">
        <div className="panel-heading">
          <h2>Issue register</h2>
          <p>Every detected problem is listed with entity and status. Nothing here is estimated.</p>
        </div>
        <DataTable
          caption="Validation issues"
          headers={headers}
          empty
          emptyMessage="No validation results yet."
        >
          {null}
        </DataTable>
      </section>
    </section>
  );
}
