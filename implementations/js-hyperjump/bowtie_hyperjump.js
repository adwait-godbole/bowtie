import readline from "readline/promises";
import os from "os";
import process from "process";
import { createRequire } from "node:module";
const packageJson = createRequire(import.meta.url)(
  "./node_modules/@hyperjump/json-schema/package.json",
);

const hyperjump_version = packageJson.version;

const stdio = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function send(data) {
  console.log(JSON.stringify(data));
}

// versioning setup
var unregisterSchema;
var registerSchemaAndValidate;
var modernSkippedTests;
var legacySkippedTests;
var getRetrievalURI;

async function setup() {
  // skip
  const keywordsNotInSchemaMessage =
    "Ignoring schema meta-data keywords in places that are not schemas (such as a $id in a const) is not supported. Because this implementation is dialect agnostic, there's no way to know whether a location is a schema or not. Especially because there's no reason for a schema to use keywords in places that aren't schemas, I'm not concerned about making it work.";

  const boundaryCrossingMessage =
    "JSON pointers that cross schema resource boundaries are not suppported. There might be a way to solve this, but because this functionality has been removed from the spec and there is no good reason to do this in any version of the spec, it will probably never be fixed.";
  const boundaryCrossingSkippedTests = {
    "base URI change - change folder in subschema": boundaryCrossingMessage,
  };

  if (hyperjump_version >= "1.7.0") {
    await Promise.all([
      import("@hyperjump/json-schema/draft-04"),
      import("@hyperjump/json-schema/draft-06"),
      import("@hyperjump/json-schema/draft-07"),
      import("@hyperjump/json-schema/draft-2019-09"),
    ]);
    const module = await import("@hyperjump/json-schema/draft-2020-12");

    registerSchemaAndValidate = async (testCase, dialect, retrievalURI) => {
      for (const id in testCase.registry) {
        const schema = testCase.registry[id];
        if (!schema.$schema || schema.$schema === dialect) {
          module.registerSchema(schema, id, dialect);
        }
      }

      module.registerSchema(testCase.schema, retrievalURI, dialect);

      return await module.validate(retrievalURI);
    };
    unregisterSchema = module.unregisterSchema;
    getRetrievalURI = (_, __, args) =>
      `https://example.com/bowtie-sent-schema-${args.seq.toString()}`;

    const keywordsNotInSchemaSkippedTests = [
      "naive replacement of $ref with its destination is not correct",
      "$ref prevents a sibling id from changing the base uri",
      "$ref prevents a sibling $id from changing the base uri",
    ].reduce((acc, description) => {
      acc[description] = keywordsNotInSchemaMessage;
      return acc;
    }, {});

    const fileSchemeMessage =
      "Self-identifying with a `file:` URI is not allowed for security reasons.";
    const fileSchemeSkippedTests = {
      "id with file URI still resolves pointers - *nix": fileSchemeMessage,
      "id with file URI still resolves pointers - windows": fileSchemeMessage,
      "$id with file URI still resolves pointers - *nix": fileSchemeMessage,
      "$id with file URI still resolves pointers - windows": fileSchemeMessage,
    };

    modernSkippedTests = { ...fileSchemeSkippedTests };
    legacySkippedTests = {
      ...boundaryCrossingSkippedTests,
      ...keywordsNotInSchemaSkippedTests,
      ...fileSchemeSkippedTests,
    };
  } else {
    if (hyperjump_version >= "1.0.0") {
      const module = await import("@hyperjump/json-schema");

      registerSchemaAndValidate = async (testCase, dialect, retrievalURI) => {
        for (const id in testCase.registry) {
          try {
            module.addSchema(testCase.registry[id], id, dialect);
          } catch {}
        }

        module.addSchema(testCase.schema, retrievalURI, dialect);

        return await module.validate(retrievalURI);
      };
    } else {
      const JsonSchema = await import("@hyperjump/json-schema");

      registerSchemaAndValidate = async (testCase, dialect, retrievalURI) => {
        for (const id in testCase.registry) {
          try {
            JsonSchema.add(testCase.registry[id], id, dialect);
          } catch {}
        }

        JsonSchema.add(testCase.schema, retrievalURI, dialect);
        const schema = JsonSchema.get(retrievalURI);

        return await JsonSchema.validate(schema);
      };
    }

    unregisterSchema = (...args) => {};
    getRetrievalURI = (testCase, dialect, args) => {
      const idToken =
        dialect === "http://json-schema.org/draft-04/schema#" ? "id" : "$id";
      const host = testCase.schema?.[idToken]?.startsWith("file:")
        ? "file://"
        : "https://example.com";

      return `${host}/bowtie.sent.schema.${args.seq.toString()}.json`;
    };

    const keywordsNotInSchemaSkippedTests = [
      "id inside an enum is not a real identifier",
      "$id inside an enum is not a real identifier",
      "$id inside an unknown keyword is not a real identifier",
      "naive replacement of $ref with its destination is not correct",
      "$ref prevents a sibling id from changing the base uri",
      "$ref prevents a sibling $id from changing the base uri",
      "$anchor inside an enum is not a real identifier",
      "$anchor inside an enum is not a real identifier",
      "$id inside an unknown keyword is not a real identifier",
    ].reduce((acc, description) => {
      acc[description] = keywordsNotInSchemaMessage;
      return acc;
    }, {});

    modernSkippedTests = { ...keywordsNotInSchemaSkippedTests };
    legacySkippedTests = {
      ...boundaryCrossingSkippedTests,
      ...keywordsNotInSchemaSkippedTests,
    };
  }
}

const dialectSkippedTests = {
  "https://json-schema.org/draft/2020-12/schema": modernSkippedTests,
  "https://json-schema.org/draft/2019-09/schema": modernSkippedTests,
  "http://json-schema.org/draft-07/schema#": legacySkippedTests,
  "http://json-schema.org/draft-06/schema#": legacySkippedTests,
  "http://json-schema.org/draft-04/schema#": legacySkippedTests,
};

var started = false;
var dialect = null;

const cmds = {
  start: async (args) => {
    console.assert(args.version === 1, { args });
    started = true;
    return {
      version: 1,
      implementation: {
        language: "javascript",
        name: "hyperjump-json-schema",
        version: hyperjump_version,
        homepage: "https://json-schema.hyperjump.io/",
        issues: "https://github.com/hyperjump-io/json-schema/issues",
        source: "https://github.com/hyperjump-io/json-schema",

        dialects: [
          "https://json-schema.org/draft/2020-12/schema",
          "https://json-schema.org/draft/2019-09/schema",
          "http://json-schema.org/draft-07/schema#",
          "http://json-schema.org/draft-06/schema#",
          "http://json-schema.org/draft-04/schema#",
        ],
        os: os.platform(),
        os_version: os.release(),
        language_version: process.version,
      },
    };
  },

  dialect: async (args) => {
    console.assert(started, "Not started!");
    dialect = args.dialect;
    return { ok: true };
  },

  run: async (args) => {
    console.assert(started, "Not started!");

    const testCase = args.case;

    let results;
    const dialectSkipped = dialectSkippedTests[dialect];
    if (dialectSkipped && testCase.description in dialectSkipped) {
      results = testCase.tests.map((_) => {
        return {
          skipped: true,
          message: dialectSkippedTests[dialect][testCase.description],
        };
      });
    } else {
      const retrievalURI = getRetrievalURI(testCase, dialect, args);

      try {
        const _validate = await registerSchemaAndValidate(
          testCase,
          dialect,
          retrievalURI,
        );

        results = testCase.tests.map((test) => {
          try {
            const result = _validate(test.instance);
            return { valid: result.valid };
          } catch (error) {
            return { errored: true, context: { message: error.message } };
          }
        });
      } catch (error) {
        results = testCase.tests.map((_) => ({
          errored: true,
          context: { message: error.message },
        }));
      } finally {
        unregisterSchema(retrievalURI);

        for (const id in testCase.registry) {
          unregisterSchema(id);
        }
      }
    }

    return { seq: args.seq, results: results };
  },

  stop: async (_) => {
    console.assert(started, "Not started!");
    process.exit(0);
  },
};

async function main() {
  await setup();
  for await (const line of stdio) {
    const request = JSON.parse(line);
    const response = await cmds[request.cmd](request);
    send(response);
  }
}

main();
