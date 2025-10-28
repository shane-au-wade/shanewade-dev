import { Mistral } from "@mistralai/mistralai";
import { load } from "@std/dotenv";

const env = await load({
  envPath: ".env",
  export: true,
});

const apiKey = env.MISTRAL_API_KEY ?? "";
if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set");
}

const mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY });

const batchResults = [
  {
    id: "1db04623-744e-4f34-b869-78fd79590fae",
    object: "file",
    sizeBytes: 28788,
    createdAt: 1761628025,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:1aecf321_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "e6312230-83e6-406d-bf01-bbe23fcac2bc",
    object: "file",
    sizeBytes: 27984,
    createdAt: 1761627855,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:6b7e1c12_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "d00a6b03-e5a7-45d9-bc93-fc3e556786ce",
    object: "file",
    sizeBytes: 28801,
    createdAt: 1761627662,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:5f632b51_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "1016d6ed-8ba6-4d34-9875-532186b5b1af",
    object: "file",
    sizeBytes: 27054,
    createdAt: 1761627612,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:53058f2d_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "6eeed570-29c0-45b2-a929-dada09671ff7",
    object: "file",
    sizeBytes: 25354,
    createdAt: 1761627573,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:09a380e8_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "d5053174-2ec6-4b86-9ccc-a16659cd69cf",
    object: "file",
    sizeBytes: 26514,
    createdAt: 1761627544,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:cee3ae1e_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "ace7dc23-f397-48ff-85bf-518531b19cf5",
    object: "file",
    sizeBytes: 27832,
    createdAt: 1761627499,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:62e59399_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "b4ed1ecb-e7a7-4967-ab26-aa291ba528f4",
    object: "file",
    sizeBytes: 26419,
    createdAt: 1761627419,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:4931ac96_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "1f27c8fa-e866-4f14-b0e1-180b041539a3",
    object: "file",
    sizeBytes: 27703,
    createdAt: 1761627386,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:864fc531_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "a7ab1a85-9afb-4315-8f09-ae5526bdaf70",
    object: "file",
    sizeBytes: 28423,
    createdAt: 1761627343,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:370ef518_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "0ac0eb04-b335-4a7e-8509-61f79f4d1f19",
    object: "file",
    sizeBytes: 28651,
    createdAt: 1761627311,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:feb7f6e1_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "ef9e0a71-08f1-430b-839c-3ed2899700ae",
    object: "file",
    sizeBytes: 30992,
    createdAt: 1761627259,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:152c04a8_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "ca423a73-577e-4cd7-a9f0-1cf9bb63c882",
    object: "file",
    sizeBytes: 28878,
    createdAt: 1761627206,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:543a755f_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "9b565ef0-a5f2-4274-b457-9fefa948e142",
    object: "file",
    sizeBytes: 25772,
    createdAt: 1761627157,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:2d3ac5a1_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "545e63b3-b13a-4270-8e96-72b324091954",
    object: "file",
    sizeBytes: 47859,
    createdAt: 1761627130,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:0e1c2351_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "7dcc01c6-5fec-4a66-bd61-ea04ab3ac6eb",
    object: "file",
    sizeBytes: 29933,
    createdAt: 1761627080,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:a40a0854_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "0f4e9d28-5aed-494b-8e07-74fa7fdd8a9d",
    object: "file",
    sizeBytes: 29590,
    createdAt: 1761627039,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:21298734_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "073c2fa8-1794-4780-965a-6ef5066bb656",
    object: "file",
    sizeBytes: 26814,
    createdAt: 1761626992,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:4193988f_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "b571c6fb-0dc2-4785-943a-4a0b99cbf180",
    object: "file",
    sizeBytes: 23418,
    createdAt: 1761626952,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:1e67761d_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "eade9ae4-3a35-4685-a7a5-77ecc989efdd",
    object: "file",
    sizeBytes: 27263,
    createdAt: 1761626909,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:499e05c6_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "1d0f13a5-3855-419f-8a46-5db5b9aec86a",
    object: "file",
    sizeBytes: 32228,
    createdAt: 1761626877,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:d0d718bd_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "41541fd1-77fa-483a-9360-5eef4a6dcabe",
    object: "file",
    sizeBytes: 25103,
    createdAt: 1761626831,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:be4da5b8_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "42bdfa7f-1463-4a75-ace1-31904c1e1801",
    object: "file",
    sizeBytes: 23457,
    createdAt: 1761626799,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:eb48b2a0_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "5319776c-697f-4186-b3bf-4fc13668ac4b",
    object: "file",
    sizeBytes: 22933,
    createdAt: 1761625562,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:1f891682_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
  {
    id: "4cfbe2f5-0c44-4f7c-944a-cdc5b294853a",
    object: "file",
    sizeBytes: 22276,
    createdAt: 1761625434,
    filename:
      "batch:mistral-ocr-latest:fc6bfeba:20251028:cd42fdf5_results.jsonl",
    purpose: "batch",
    sampleType: "batch_result",
    numLines: 10,
    mimetype: "application/jsonl",
    source: "mistral",
    signature: null,
  },
];

// we have the mistral client and the batch result ids
// lets download the results and pipe them into a single jsonl file

const outputFile = "scripts/batch-ocr-results-recipes-1-to-25.jsonl";

for (const batchResult of batchResults) {
  // open the output file
  const outputFileHandle = await Deno.open(outputFile, { append: true });
  const result = await mistral.files.download({
    fileId: batchResult.id,
  });
  await result.pipeTo(outputFileHandle.writable);
}
