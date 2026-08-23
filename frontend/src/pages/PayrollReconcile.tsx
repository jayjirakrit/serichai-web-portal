import Layout from "@/components/Layout";
import Button from "@/components/Button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { reconcilePayroll, type ReconcilePayrollResponse, type FileAttachment } from "@/services/payrollReconcileService";

function downloadFileAttachment(attachment: FileAttachment) {
  const byteChars = atob(attachment.contentBase64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function PayrollReconcile() {
  const [payrollFile, setPayrollFile] = useState<File | null>(null);
  const [period, setPeriod] = useState<string>("");

  const mutation = useMutation<ReconcilePayrollResponse, Error>({
    mutationFn: () => {
      if (!payrollFile) {
        throw new Error("Please upload the payroll working file.");
      }
      if (!period) {
        throw new Error("Please select the pay period to reconcile.");
      }
      return reconcilePayroll(payrollFile, period);
    },
  });

  const onSubmit = () => {
    if (!payrollFile) {
      alert("Please upload the payroll working file before submitting.");
      return;
    }
    if (!period) {
      alert("Please select the pay period to reconcile before submitting.");
      return;
    }
    mutation.mutate();
  };

  const result = mutation.data;

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="payroll-reconcile-title flex flex-col justify-center p-8 pb-0">
          <h3 className="bold pb-2">Payroll Reconciliation</h3>
          <h6 className="text-neutral-500">Recalculate employee net wages from the payroll working file and compare them to the stated amounts.</h6>
        </div>
        <div className="payroll-reconcile-content flex p-8 gap-4">
          <div className="payroll-reconcile-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Data Source</h4>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Payroll Working File</legend>
              <input type="file" className="file-input" onChange={(e) => setPayrollFile(e.target.files?.[0] || null)} />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Pay Period</legend>
              <input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </fieldset>

            <Button className="w-fit" onClick={onSubmit}>
              {mutation.isPending ? "Processing..." : "Submit"}
            </Button>
          </div>

          <div className="payroll-reconcile-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Reconciliation Summary</h4>
            <div className="flex flex-col w-96 h-96 bg-white p-4 border border-gray-300 rounded overflow-y-auto">
              {mutation.isIdle && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold">Awaiting Data</h4>
                  <p className="text-neutral-500 text-center">Reconciliation summary will be displayed here after submitting.</p>
                </div>
              )}

              {mutation.isPending && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-neutral-500">Reconciling payroll...</p>
                </div>
              )}

              {mutation.isError && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold text-error">Reconciliation Failed</h4>
                  <p className="text-neutral-500 text-center">{mutation.error.message}</p>
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p>Total employees reconciled: <span className="font-semibold">{result.summary.totalEmployeesReconciled}</span></p>
                    <p>Matched: <span className="font-semibold">{result.summary.matchedCount}</span></p>
                    <p>Unmatched: <span className="font-semibold">{result.summary.discrepancyCount}</span></p>
                  </div>

                  {result.discrepancies.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <h5 className="font-semibold">Unmatched</h5>
                      <ul className="text-sm flex flex-col gap-1">
                        {result.discrepancies.map((entry, index) => (
                          <li key={index} className="border-b border-gray-200 pb-1">
                            <span className="font-medium">{entry.department}</span>
                            {entry.employeeName ? ` — ${entry.employeeName}` : entry.employeeId ? ` — ${entry.employeeId}` : ""}
                            {" "}
                            <span className="text-neutral-500">({entry.status})</span>
                            <br />
                            {entry.statedAmount !== null && entry.recalculatedAmount !== null && (
                              <span className="text-red-500">
                                Stated: {entry.statedAmount} : Recalculated: {entry.recalculatedAmount}
                              </span>
                            )}
                            <br />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button className="w-fit" onClick={() => downloadFileAttachment(result.reconciliationReport)}>
                      Download Reconciliation Report
                    </Button>
                    {result.discrepancyReport && (
                      <Button className="w-fit" onClick={() => downloadFileAttachment(result.discrepancyReport!)}>
                        Download Unmatched Report
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default PayrollReconcile;
