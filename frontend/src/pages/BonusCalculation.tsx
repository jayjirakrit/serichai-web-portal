import Layout from "@/components/Layout";
import Button from "@/components/Button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { calculateBonus, type CalculateBonusResponse, type FileAttachment } from "@/services/bonusService";

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

function BonusCalculation() {
  const [tab, setTab] = useState<"cal" | "config">("cal");
  const [currentYearFile, setCurrentYearFile] = useState<File | null>(null);
  const [previousYearSummaryFile, setPreviousYearSummaryFile] = useState<File | null>(null);
  const [year, setYear] = useState<string>("");

  const calculationMutation = useMutation<CalculateBonusResponse, Error>({
    mutationFn: () => {
      if (!currentYearFile) {
        throw new Error("Please upload the current-year data file.");
      }
      if (!previousYearSummaryFile) {
        throw new Error("Please upload the previous-year summary file.");
      }
      if (!year) {
        throw new Error("Please enter the year to calculate.");
      }
      return calculateBonus(currentYearFile, previousYearSummaryFile, year);
    },
  });

  const onSubmitCalculation = () => {
    if (!currentYearFile) {
      alert("Please upload the current-year data file before submitting.");
      return;
    }
    if (!previousYearSummaryFile) {
      alert("Please upload the previous-year summary file before submitting.");
      return;
    }
    if (!year) {
      alert("Please enter the year before submitting.");
      return;
    }
    calculationMutation.mutate();
  };

  const calculationResult = calculationMutation.data;

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div role="tablist" className="tabs tabs-bordered px-8 pt-4">
          <button
            role="tab"
            className={`tab ${tab === "cal" ? "tab-active" : ""}`}
            onClick={() => setTab("cal")}
          >
            Calculation
          </button>
          <button
            role="tab"
            className={`tab ${tab === "config" ? "tab-active" : ""}`}
            onClick={() => setTab("config")}
          >
            Configuration
          </button>
        </div>

        <div className="emp-bene-title flex flex-col justify-center p-8 pb-0">
          <h3 className="bold pb-2">Bonus Calculation</h3>
          <h6 className="text-neutral-500">Process bonus calculations for the current fiscal period.</h6>
        </div>

        {tab == "cal" && (
          <div className="emp-bene-content flex p-8 gap-4">
            <div className="emp-bene-content-files flex flex-col gap-2">
              <h4 className="font-semibold">Data Source</h4>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Current-Year Data File</legend>
                <input
                  type="file"
                  className="file-input"
                  onChange={(e) => setCurrentYearFile(e.target.files?.[0] || null)}
                />
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Previous-Year Summary File</legend>
                <input
                  type="file"
                  className="file-input"
                  onChange={(e) => setPreviousYearSummaryFile(e.target.files?.[0] || null)}
                />
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Year</legend>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 2025"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </fieldset>

              <Button className="w-fit" onClick={onSubmitCalculation}>
                {calculationMutation.isPending ? "Calculating..." : "Calculate Bonus"}
              </Button>
            </div>

            <div className="emp-bene-content-files flex flex-col gap-2">
              <h4 className="font-semibold">Calculation Summary</h4>
              <div className="flex flex-col w-96 h-96 bg-white p-4 border border-gray-300 rounded overflow-y-auto">
                {calculationMutation.isIdle && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <h4 className="font-semibold">Awaiting Data</h4>
                    <p className="text-neutral-500 text-center">Calculation summary will be displayed here after submitting.</p>
                  </div>
                )}

                {calculationMutation.isPending && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-neutral-500">Calculating bonus...</p>
                  </div>
                )}

                {calculationMutation.isError && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <h4 className="font-semibold text-error">Calculation Failed</h4>
                    <p className="text-neutral-500 text-center">{calculationMutation.error.message}</p>
                  </div>
                )}

                {calculationResult && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p>Total employees: <span className="font-semibold">{calculationResult.summary.totalEmployees}</span></p>
                      <p>Calculated: <span className="font-semibold">{calculationResult.summary.calculatedCount}</span></p>
                      <p>Exceptions: <span className="font-semibold">{calculationResult.summary.exceptionCount}</span></p>
                    </div>

                    {calculationResult.flaggedEmployees.length === 0 ? (
                      <p className="font-medium text-success">All employees calculated successfully — 0 exceptions</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <h5 className="font-semibold">Flagged Employees</h5>
                        <ul className="text-sm flex flex-col gap-1">
                          {calculationResult.flaggedEmployees.map((employee, index) => (
                            <li key={index} className="border-b border-gray-200 pb-1">
                              <span className="font-medium">{employee.firstName} {employee.lastName}</span>
                              <br />
                              <span className="text-red-500">{employee.exceptionNote}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button className="w-fit" onClick={() => downloadFileAttachment(calculationResult.bonusReport)}>
                      Download Bonus Report
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default BonusCalculation;
