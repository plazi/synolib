import type { JustifiedSynonym, Treatment } from "./SynonymGroup.ts";

interface Justification {
  toString: () => string;
  precedingSynonym?: JustifiedSynonym; // eslint-disable-line no-use-before-define
}

interface TreatmentJustification extends Justification {
  treatment: Treatment;
}
type LexicalJustification = Justification;
export type anyJustification = TreatmentJustification | LexicalJustification;

export class JustificationSet implements AsyncIterable<anyJustification> {
  private monitor = new EventTarget();
  contents: anyJustification[] = [];
  isFinished = false;
  isAborted = false;
  entries = ((Array.from(this.contents.values()).map((v) => [v, v])) as [
    anyJustification,
    anyJustification,
  ][]).values;

  constructor(iterable?: Iterable<anyJustification>) {
    if (iterable) {
      for (const el of iterable) {
        this.add(el);
      }
    }
    return this;
  }

  get size() {
    return new Promise<number>((resolve, reject) => {
      if (this.isAborted) {
        reject(new Error("JustificationSet has been aborted"));
      } else if (this.isFinished) {
        resolve(this.contents.length);
      } else {
        const listener = () => {
          if (this.isFinished) {
            this.monitor.removeEventListener("updated", listener);
            resolve(this.contents.length);
          }
        };
        this.monitor.addEventListener("updated", listener);
      }
    });
  }

  add(value: anyJustification) {
    if (
      this.contents.findIndex((c) => c.toString() === value.toString()) === -1
    ) {
      this.contents.push(value);
      this.monitor.dispatchEvent(new CustomEvent("updated"));
    }
    return this;
  }

  finish() {
    //console.info("%cJustificationSet finished", "color: #69F0AE;");
    this.isFinished = true;
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }

  forEachCurrent(cb: (val: anyJustification) => void) {
    this.contents.forEach(cb);
  }

  first() {
    return new Promise<anyJustification>((resolve) => {
      if (this.contents[0]) {
        resolve(this.contents[0]);
      } else {
        this.monitor.addEventListener("update", () => {
          resolve(this.contents[0]);
        });
      }
    });
  }

  [Symbol.toStringTag] = "";
  [Symbol.asyncIterator]() {
    // this.monitor.addEventListener("updated", () => console.log("ARA"));
    let returnedSoFar = 0;
    return {
      next: () => {
        return new Promise<IteratorResult<anyJustification>>(
          (resolve, reject) => {
            const _ = () => {
              if (this.isAborted) {
                reject(new Error("JustificationSet has been aborted"));
              } else if (returnedSoFar < this.contents.length) {
                resolve({ value: this.contents[returnedSoFar++] });
              } else if (this.isFinished) {
                resolve({ done: true, value: true });
              } else {
                const listener = () => {
                  console.log("ahgfd");
                  this.monitor.removeEventListener("updated", listener);
                  _();
                };
                this.monitor.addEventListener("updated", listener);
              }
            };
            _();
          },
        );
      },
    };
  }
}
