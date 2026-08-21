import Layout from "@/components/Layout";
import Button from "@/components/Button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { calculateBenefits, type CalculateBenefitsResponse, type FileAttachment } from "@/services/benefitsService";

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

function EmployeeBenefits() {
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);
  const [previousBenefitsFile, setPreviousBenefitsFile] = useState<File | null>(null);

  const mutation = useMutation<CalculateBenefitsResponse, Error>({
    mutationFn: () => {
      if (!masterDataFile) {
        throw new Error("Please upload the employee master data file.");
      }
      return calculateBenefits(masterDataFile, previousBenefitsFile);
    },
  });

  const onSubmit = () => {
    if (!masterDataFile) {
      alert("Please upload the employee master data file before submitting.");
      return;
    }
    mutation.mutate();
  };

  const result = mutation.data;

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="emp-bene-title flex flex-col justify-center p-8 pb-0">
          <h3 className="bold pb-2">Employee Benefits Calculation</h3>
          <h6 className="text-neutral-500">Compute the annual employee benefit liability directly from the employee master data.</h6>
        </div>
        <div className="emp-bene-content flex p-8 gap-4">
          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Data Source</h4>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Employee Master Data</legend>
              <input type="file" className="file-input" onChange={(e) => setMasterDataFile(e.target.files?.[0] || null)} />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Previous Employee Benefits</legend>
              <input type="file" className="file-input" onChange={(e) => setPreviousBenefitsFile(e.target.files?.[0] || null)} />
            </fieldset>

            <Button className="w-fit" onClick={onSubmit}>
              {mutation.isPending ? "Processing..." : "Submit"}
            </Button>
          </div>

          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Validation Summary</h4>
            <div className="flex flex-col w-96 h-96 bg-white p-4 border border-gray-300 rounded overflow-y-auto">
              {mutation.isIdle && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold">Awaiting Data</h4>
                  <p className="text-neutral-500 text-center">Validation summary will be displayed here after calculating the benefit.</p>
                </div>
              )}

              {mutation.isPending && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-neutral-500">Calculating benefits...</p>
                </div>
              )}

              {mutation.isError && (
                <div className="flex flex-col items-center justify-center h-full">
                  <h4 className="font-semibold text-error">Validation Failed</h4>
                  <p className="text-neutral-500 text-center">{mutation.error.message}</p>
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p>Total employees out: <span className="font-semibold">{result.summary.totalEmployeesOut}</span></p>
                    <p>Computed: <span className="font-semibold">{result.summary.computedCount}</span></p>
                    <p>Resigned flagged: <span className="font-semibold">{result.summary.resignedFlaggedCount}</span></p>
                    <p>Exceptions: <span className="font-semibold">{result.summary.exceptionCount}</span></p>
                  </div>

                  {result.exceptions.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <h5 className="font-semibold">Exceptions</h5>
                      <ul className="text-sm flex flex-col gap-1">
                        {result.exceptions.map((exception, index) => (
                          <li key={index} className="border-b border-gray-200 pb-1">
                            <span className="font-medium">{exception.category}</span>
                            {exception.employeeName
                              ? ` — ${exception.employeeName}`
                              : exception.employeeId
                                ? ` — ${exception.employeeId}`
                                : ""}
                            <br />
                            <span className="text-neutral-500">{exception.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button className="w-fit" onClick={() => downloadFileAttachment(result.employeeBenefitsReport)}>
                      Download Benefit Report
                    </Button>
                    <Button className="w-fit" onClick={() => downloadFileAttachment(result.exceptionReport)}>
                      Download Exception Report
                    </Button>
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

export default EmployeeBenefits;
