export class Predicate {
  constructor(public colName: string, public op: string, public val: string) {}

  static parse(predicateStr: string) {
    const result: Predicate[] = [];

    const regex = /([a-zA-Z0-9]+)\s*([><=!]+)\s*([a-zA-Z0-9]+)/gm;
    let m: RegExpExecArray | null = null;
    while ((m = regex.exec(predicateStr)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      result.push(new Predicate(m[1], m[2], m[3]));
    }

    return result;
  }

  get alias() {
    return `${this.colName} ${this.op} ${this.val}`;
  }
}

export type StepAction = "scanR" | "select" | "map";
export class Step {
  constructor(
    public action: StepAction,
    public predicate: Predicate | null = null,
    public columns: string[] = []
  ) {}

  toString() {
    return `${this.action} (${this.predicate?.alias ?? ""}${this.columns})`;
  }
}

export type ExpType = "dnf" | "cnf";
export type AndOr = "AND" | "OR";
class ExpTypeInfo {
  static DNF = new ExpTypeInfo("dnf", "OR", "AND");
  static CNF = new ExpTypeInfo("cnf", "AND", "OR");
  static getInfo(type: ExpType) {
    if (type === "dnf") return ExpTypeInfo.DNF;
    if (type === "cnf") return ExpTypeInfo.CNF;
    throw Error("Invalid type");
  }
  constructor(
    public type: ExpType,
    public outStr: AndOr,
    public inStr: AndOr
  ) {}
}

export class Assignment {
  constructor(public predicate: Predicate, public val: boolean) {}
}

export class BooleanExp {
  constructor(public predicateGroups: Predicate[][], public expType: ExpType) {}

  static parse(queryStr: string, expType: ExpType) {
    const { outStr } = ExpTypeInfo.getInfo(expType);
    const predicateGroups = queryStr
      .split(outStr)
      .map((groupStr) => Predicate.parse(groupStr));
    return new BooleanExp(predicateGroups, expType);
  }

  get predicates() {
    return this.predicateGroups.map((g) => g.map((p) => p)).flat();
  }

  applyAsg(asg: Assignment) {
    let predicateGroups: typeof this.predicateGroups = [];
    if (this.expType === "dnf") {
      for (let predicateGroup of this.predicateGroups) {
        if (predicateGroup.includes(asg.predicate)) {
          if (asg.val) {
            // asg => true

            const predicates = predicateGroup.filter((p) => p != asg.predicate);
            if (predicates.length == 0) {
              // True group, already SAT, evaluate any following groups is not needed.
              // console.log("true group", predicateGroup);
              predicateGroups = [];
              break;
            }
            predicateGroups.push(predicates);
          }
        } else {
          predicateGroups.push(predicateGroup);
        }
      }
    }
    if (this.expType === "cnf") {
      for (let predicateGroup of this.predicateGroups) {
        if (predicateGroup.includes(asg.predicate)) {
          if (!asg.val) {
            // asg => false

            const predicates = predicateGroup.filter((p) => p != asg.predicate);
            if (predicates.length == 0) {
              // False group, already UN-SAT, evaluate any following groups is not needed.
              // console.log("false group", predicateGroup);
              predicateGroups = [];
              break;
            }
            predicateGroups.push(predicates);
          }
        } else {
          predicateGroups.push(predicateGroup);
        }
      }
    }
    return new BooleanExp(predicateGroups, this.expType);
  }

  toString() {
    const { inStr, outStr } = ExpTypeInfo.getInfo(this.expType);
    return this.predicateGroups
      .map((group) => `(${group.map((p) => p.alias).join(` ${inStr} `)})`)
      .join(` ${outStr} `);
  }
}
