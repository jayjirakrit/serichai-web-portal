import Layout from "@/components/Layout";
import Button from "@/components/Button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { calculateTaxDeduction, type CalculateTaxDeductionResponse, type FileAttachment, type TaxDeductionEmployeeResult } from "@/services/taxDeductionService";
import taxReductionInputTemplate from "@/assets/Tax_Reduction_Input.xlsx?url";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getEmployeeStatus(employee: TaxDeductionEmployeeResult): { label: string; badgeClass: string } {
  if (!employee.eligible) {
    return { label: "Not eligible", badgeClass: "badge-neutral" };
  }
  if (!employee.selected) {
    return { label: "Eligible, not selected", badgeClass: "badge-warning" };
  }
  if (employee.disabled) {
    return { label: "Selected (disabled, uncapped)", badgeClass: "badge-success" };
  }
  return { label: "Selected", badgeClass: "badge-success" };
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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

function TaxDeduction() {
  const [payrollFile, setPayrollFile] = useState<File | null>(null);
  const [referenceDate, setReferenceDate] = useState<string>("");

  const mutation = useMutation<CalculateTaxDeductionResponse, Error>({
    mutationFn: () => {
      if (!payrollFile) {
        throw new Error("Please upload the payroll file.");
      }
      return calculateTaxDeduction(payrollFile, referenceDate || undefined);
    },
  });

  const onSubmit = () => {
    if (!payrollFile) {
      alert("Please upload the payroll file before submitting.");
      return;
    }
    mutation.mutate();
  };

  const result = mutation.data;

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="emp-bene-title flex flex-col justify-center p-8 pb-0">
          <h3 className="bold pb-2">Elderly-Employee Tax Deduction</h3>
          <h6 className="text-neutral-500">Compute the elderly-employee tax deduction directly from the payroll data and download the filled workbook.</h6>
        </div>
        <div className="emp-bene-content flex p-8 gap-4">
          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Data Source</h4>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Source File</legend>
              <input type="file" className="file-input" onChange={(e) => setPayrollFile(e.target.files?.[0] || null)} />
            </fieldset>

            <Button className="w-fit" onClick={onSubmit}>
              {mutation.isPending ? "Processing..." : "Submit"}
            </Button>
          </div>

          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Result Summary</h4>
            <div className="flex flex-col w-96 h-96 bg-white p-4 border border-gray-300 rounded overflow-y-auto">
              {mutation.isIdle && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold">Awaiting Data</h4>
                  <p className="text-neutral-500 text-center">Result summary will be displayed here after calculating the deduction.</p>
                </div>
              )}

              {mutation.isPending && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-neutral-500">Calculating tax deduction...</p>
                </div>
              )}

              {mutation.isError && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold text-error">Calculation Failed</h4>
                  <p className="text-neutral-500 text-center">{mutation.error.message}</p>
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p>Reference date: <span className="font-semibold">{result.summary.referenceDate}</span></p>
                    <p>Total headcount: <span className="font-semibold">{result.summary.totalHeadcount}</span></p>
                    <p>Eligible: <span className="font-semibold">{result.summary.eligibleCount}</span></p>
                    <p>Headcount cap: <span className="font-semibold">{result.summary.headcountCap}</span></p>
                    <p>Selected: <span className="font-semibold">{result.summary.selectedCount}</span></p>
                  </div>

                  <div className="collapse collapse-arrow bg-surface-low border border-gray-200 rounded">
                    <input type="checkbox" defaultChecked />
                    <div className="collapse-title font-semibold">Active rules for this run</div>
                    <div className="collapse-content flex flex-col gap-1">
                      <p>Age threshold: <span className="font-semibold">&gt; {result.summary.ageThreshold}</span></p>
                      <p>Salary cap per month: <span className="font-semibold">{formatNumber(result.summary.salaryCapPerMonth)}</span></p>
                      <p>Headcount cap: <span className="font-semibold">{(result.summary.headcountCapPercent * 100).toFixed(0)}%</span></p>
                      <p>BE year offset: <span className="font-semibold">{result.summary.beYearOffset}</span></p>
                      <p>Reference date used: <span className="font-semibold">{result.summary.referenceDate}</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button className="w-fit" onClick={() => downloadFileAttachment(result.taxDeductionReport)}>
                      Download Filled Workbook
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Instruction</h4>
            <div className="flex flex-col w-96 h-96 bg-white p-4 border border-gray-300 rounded overflow-y-auto">
              <ol className="list-decimal list-inside">
                <li>Prepare employee input file.</li>
                <li><a href={taxReductionInputTemplate} download="Tax_Reduction_Input.xlsx"><strong>Download</strong></a> the template and fill data.</li>
                <li>Upload the file.</li>
                <li>Click Submit.</li>
              </ol>
            </div>
          </div>
          
        </div>

        {result && (
          <div className="emp-bene-content-table flex flex-col gap-2 px-8 pb-8">
            <h4 className="font-semibold">Employee Breakdown</h4>
            <div className="w-full max-h-[32rem] overflow-x-auto overflow-y-auto bg-white border border-gray-300 rounded">
              <table className="table table-sm table-zebra table-pin-rows">
                <thead>
                  <tr>
                    <th>Seq</th>
                    <th>Name</th>
                    <th className="text-right">Age</th>
                    <th className="text-right">Avg. Salary</th>
                    <th>Status</th>
                    {MONTH_LABELS.map((label) => (
                      <th key={label} className="text-right">{label}</th>
                    ))}
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.employees.map((employee) => {
                    const status = getEmployeeStatus(employee);
                    return (
                      <tr key={employee.seq}>
                        <td>{employee.seq}</td>
                        <td className="whitespace-nowrap">{employee.prefix}{employee.firstName} {employee.lastName}</td>
                        <td className="text-right">{employee.age ?? "-"}</td>
                        <td className="text-right">{formatNumber(employee.averageMonthlySalary)}</td>
                        <td className="whitespace-nowrap">
                          <span className={`badge ${status.badgeClass} whitespace-nowrap`}>{status.label}</span>
                        </td>
                        {employee.monthlyAmounts.map((amount, index) => (
                          <td key={index} className="text-right">{formatNumber(amount)}</td>
                        ))}
                        <td className="font-semibold text-right">{formatNumber(employee.totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default TaxDeduction;
