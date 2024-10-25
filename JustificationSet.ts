// @ts-ignore: Import unneccesary for typings, will collate .d.ts files
import type { JustifiedSynonym, Treatment } from "./mod.ts";

/** //TODO */
export type Justification = {
  /** //TODO */
  toString: () => string;
  /** //TODO */
  treatment?: Treatment;
  /** //TODO */
  precedingSynonym?: JustifiedSynonym; // eslint-disable-line no-use-before-define
}

/** //TODO */
export class JustificationSet implements AsyncIterable<Justification> {
  /** @internal */
  private monitor = new EventTarget();
  /** @internal */
  contents: Justification[] = [];
  /** @internal */
  isFinished = false;
  /** @internal */
  isAborted = false;
  /** @internal */
  entries = ((Array.from(this.contents.values()).map((v) => [v, v])) as [
    Justification,
    Justification,
  ][]).values;
  /** @internal */
  constructor(iterable?: Iterable<Justification>) {
    if (iterable) {
      for (const el of iterable) {
        this.add(el);
      }
    }
    return this;
  }
  /** @internal */
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

  /** @internal */
  add(value: Justification) {
    if (
      this.contents.findIndex((c) => c.toString() === value.toString()) === -1
    ) {
      this.contents.push(value);
      this.monitor.dispatchEvent(new CustomEvent("updated"));
    }
    return this;
  }

  /** @internal */
  finish(): void {
    //console.info("%cJustificationSet finished", "color: #69F0AE;");
    this.isFinished = true;
    this.monitor.dispatchEvent(new CustomEvent("updated"));
  }

  /** @internal */
  forEachCurrent(cb: (val: Justification) => void): void {
    this.contents.forEach(cb);
  }

  /** @internal */
  first(): Promise<Justification> {
    return new Promise<Justification>((resolve) => {
      if (this.contents[0]) {
        resolve(this.contents[0]);
      } else {
        this.monitor.addEventListener("update", () => {
          resolve(this.contents[0]);
        });
      }
    });
  }

  /** //TODO */
  [Symbol.asyncIterator](): AsyncIterator<Justification> {
    // this.monitor.addEventListener("updated", () => console.log("ARA"));
    let returnedSoFar = 0;
    return {
      next: () => {
        return new Promise<IteratorResult<Justification>>(
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
