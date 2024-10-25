async function sleep(ms: number): Promise<void> {
  const p = new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
  return await p;
}

/** Describes the format of the JSON return by SPARQL endpoints */
export type SparqlJson = {
  head: {
    vars: string[];
  };
  results: {
    bindings: {
      [key: string]: { type: string; value: string; "xml:lang"?: string };
    }[];
  };
};

/**
 * Represents a remote sparql endpoint and provides a uniform way to run queries.
 */
export class SparqlEndpoint {
  /** Create a new SparqlEndpoint with the given URI */
  constructor(private sparqlEnpointUri: string) {}

  /**
   * Run a query against the sparql endpoint
   *
   * It automatically retries up to 10 times on fetch errors, waiting 50ms on the first retry and doupling the wait each time.
   * Retries are logged to the console (`console.warn`)
   *
   * @throws In case of non-ok response status codes or if fetch failed 10 times.
   * @param query The sparql query to run against the endpoint
   * @param fetchOptions Additional options for the `fetch` request
   * @param _reason (Currently ignored, used internally for debugging purposes)
   * @returns Results of the query
   */
  async getSparqlResultSet(
    query: string,
    fetchOptions: RequestInit = {},
    _reason = "",
  ): Promise<SparqlJson> {
    fetchOptions.headers = fetchOptions.headers || {};
    (fetchOptions.headers as Record<string, string>)["Accept"] =
      "application/sparql-results+json";
    let retryCount = 0;
    const sendRequest = async (): Promise<SparqlJson> => {
      try {
        // console.info(`SPARQL ${_reason} (${retryCount + 1})`);
        const response = await fetch(
          this.sparqlEnpointUri + "?query=" + encodeURIComponent(query),
          fetchOptions,
        );
        if (!response.ok) {
          throw new Error("Response not ok. Status " + response.status);
        }
        return await response.json();
      } catch (error) {
        if (fetchOptions.signal?.aborted) {
          throw error;
        } else if (retryCount < 10) {
          const wait = 50 * (1 << retryCount++);
          console.warn(`!! Fetch Error. Retrying in ${wait}ms (${retryCount})`);
          await sleep(wait);
          return await sendRequest();
        }
        console.warn("!! Fetch Error:", query, "\n---\n", error);
        throw error;
      }
    };
    return await sendRequest();
  }
}
