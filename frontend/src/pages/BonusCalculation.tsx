import Layout from "@/components/Layout";
import Button from "@/components/Button";
import { useState } from "react";

function BonusCalculation() {
  const [benefitsFile, setBenefitsFile] = useState<File | null>(null);
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);

  const validateFiles = () => {
    if (!benefitsFile || !masterDataFile) {
      alert("Please upload both files before validating.");
      return;
    }
  };

  return (
    <Layout>
      <div className="h-screen bg-surface-bright">
        <div className="emp-bene-title flex flex-col justify-center p-8 pb-0">
          <h3 className="bold pb-2">Bonus Calculation</h3>
          <h6 className="text-neutral-500">Process bonus calculations for the current fiscal period.</h6>
        </div>
        <div className="emp-bene-content flex p-8 gap-4">
          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Data Source</h4>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Employee Benefits Master File</legend>
              <input type="file" className="file-input" onChange={(e) => setBenefitsFile(e.target.files?.[0] || null)} />
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Employee Master Data</legend>
              <input type="file" className="file-input" onChange={(e) => setMasterDataFile(e.target.files?.[0] || null)} />
            </fieldset>

            <Button className="w-fit" onClick={validateFiles}>
              Validate Files
            </Button>
          </div>

          <div className="emp-bene-content-files flex flex-col gap-2">
            <h4 className="font-semibold">Validation Summary</h4>
            <div className="flex flex-col items-center w-96 h-96 bg-white p-4 border border-gray-300 rounded">
              <h4 className="font-semibold">Awaiting Data</h4>
              <p className="text-neutral-500">Validation summary will be displayed here after validating the files.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default BonusCalculation;
