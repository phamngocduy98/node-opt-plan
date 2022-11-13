import fs from "fs/promises";
import { Assignment, BooleanExp, Predicate, Step } from "./type";

class OperationResult {
  constructor(
    public trueRowIds: number[] = [],
    public falseRowIds: number[] = [],
    public selectedColumns: string[] = []
  ) {}

  getRowIds(branch: boolean) {
    return branch ? this.trueRowIds : this.falseRowIds;
  }
}

export class PlanTreeNode {
  constructor(public steps: Step[]) {}
}

export class PlanTree {
  constructor(public arr = [new PlanTreeNode([new Step("scanR")])]) {}
  appendChildTree(branch: boolean, child: PlanTree) {
    let rootNode = this.arr[0];
    for (let i = 0; i < child.arr.length; i++) {
      const node = child.arr[i];
      if (node != null) {
        const { parent: cParentNode, branch: cBranch } = child.getParent(node);
        if (cParentNode == null) {
          // is root of child plan tree
          this.appendChild(rootNode, branch, node);
        } else {
          this.appendChild(cParentNode, cBranch, node);
        }
      }
    }
  }

  appendChild(parent: PlanTreeNode, branch: boolean, child: PlanTreeNode) {
    const parentIdx = this.arr.indexOf(parent);
    const childIdx = branch ? 2 * parentIdx + 2 : 2 * parentIdx + 1;
    this.arr[childIdx] = child;
  }

  getParent(child: PlanTreeNode) {
    const childIdx = this.arr.indexOf(child);
    if (childIdx == -1) {
      return {
        parent: null,
        branch: false,
      };
    }
    return {
      parent: this.arr[Math.floor((childIdx - 1) / 2)],
      branch: (childIdx - 1) % 2 === 1,
    };
  }

  getChild(parent: PlanTreeNode, branch: boolean) {
    const parentIdx = this.arr.indexOf(parent);
    return this.arr[2 * parentIdx + (branch ? 2 : 1)];
  }

  get predicates() {
    return this.arr
      .map((node) => node.steps.map((step) => step.predicate))
      .flat();
  }

  copy() {
    return new PlanTree(
      this.arr.map((node) => new PlanTreeNode([...node.steps]))
    );
  }

  print() {
    const browse = (level: string, root: PlanTreeNode | null) => {
      if (root != null) {
        console.log(`${level}${root.steps.map((s) => s.toString())}`);
        browse(level + "    T ", this.getChild(root, true));
        browse(level + "    F ", this.getChild(root, false));
      }
    };
    browse("", this.arr[0]);
  }
}

export class DBMS {
  columns: [string, number][];
  mapColumns: string[];
  rawData: string[][][] | null = null;
  rawDataRowIndex: number[] = [];
  constructor() {
    this.columns = [
      // Forest Data only
      ["Elevation", 1],
      ["Aspect", 1],
      ["Slope", 1],
      ["Horizontal_Distance_To_Hydrology", 1],
      ["Vertical_Distance_To_Hydrology", 1],
      ["Horizontal_Distance_To_Roadways", 1],
      ["Hillshade_9am", 1],
      ["Hillshade_Noon", 1],
      ["Hillshade_3pm", 1],
      ["Horizontal_Distance_To_Fire_Points", 1],
      ["Wilderness_Area", 4],
      ["Soil_Type", 40],
      ["Cover_Type", 1],
    ];
    this.mapColumns = [];
  }

  getData(rowId: number, columnName: string) {
    if (this.rawData == null) {
      throw Error("Not scaned");
    }
    const colIdx = this.columns.findIndex(
      (colInfo) => colInfo[0] === columnName
    );
    if (colIdx === -1) throw Error("invalid column");
    return this.rawData[rowId][colIdx];
  }

  async scan() {
    if (this.rawData != null) {
      return new OperationResult(this.rawDataRowIndex, [], []);
    }

    const buff = await fs.readFile("covtype.data");
    const content = buff.toString();
    const rows = content.split("\r\n");

    this.rawData = [];
    for (let i = 0; i < rows.length; i++) {
      const rowString = rows[i];
      const rowRawData = rowString.split(",");
      const row = [];
      let idx = 0;
      for (let col of this.columns) {
        const data = rowRawData.slice(idx, idx + col[1]);
        row.push(data);
        idx += col[1];
      }
      this.rawData.push(row);
      this.rawDataRowIndex.push(i);
    }

    return new OperationResult(this.rawDataRowIndex, [], []);
  }

  async map(opRes: OperationResult, columns: string[]) {
    return new OperationResult(
      [...opRes.trueRowIds],
      [...opRes.falseRowIds],
      [...opRes.selectedColumns, ...columns]
    );
  }

  check(v1: string, op: string, v2: string) {
    switch (op) {
      case "=":
        return v1 == v2;
      case "!=":
        return v1 != v2;
      case "<=":
        return v1 <= v2;
      case "<":
        return v1 < v2;
      case ">=":
        return v1 >= v2;
      case ">":
        return v1 > v2;
    }
    return false;
  }

  async select(opRes: OperationResult, predicate: Predicate, branch: boolean) {
    const resultT = [];
    const resultF = [];

    for (let rowId of opRes.getRowIds(branch)) {
      const colData = this.getData(rowId, predicate.colName);
      if (this.check(colData[0], predicate.op, predicate.val)) {
        resultT.push(rowId);
      } else {
        resultF.push(rowId);
      }
    }
    return new OperationResult(resultT, resultF, [...opRes.selectedColumns]);
  }

  cost(plan: PlanTree | null) {
    return 1;
  }

  buildPlan(p: Predicate, e: PlanTree, branch: boolean) {
    const Xp = [p.colName];
    const Xe = e.predicates.map((p) => p?.colName);
    const Xpe = Xp.filter((colName) => !Xe.includes(colName));
    if (e.arr.length === 1 && e.arr[0].steps[0].action == "scanR") {
      return new PlanTree([
        new PlanTreeNode([new Step("map", null, Xp), new Step("select", p)]),
      ]);
    } else if (branch) {
      return new PlanTree([
        new PlanTreeNode([new Step("map", null, Xpe), new Step("select", p)]),
      ]);
    } else {
      return new PlanTree([
        new PlanTreeNode([new Step("map", null, Xpe), new Step("select", p)]),
      ]);
    }
  }

  TDSim(
    e: PlanTree,
    bxp: BooleanExp,
    asg: Assignment[],
    branch: boolean
  ): [PlanTree | null, PlanTree[]] {
    let bestCost = Infinity;
    let bestPlan: PlanTree | null = null;
    let plans: PlanTree[] = [];

    console.log("asg=", asg);
    console.log("bxp = ", bxp.predicateGroups);
    console.log("================================");

    for (let p of bxp.predicates) {
      const e_ = this.buildPlan(p, e, branch);
      let A = new Assignment(p, true);
      // console.log("asg=", A.predicate, A.val);
      const eT = this.TDSim(e_, bxp.applyAsg(A), [...asg, A], true)[0];
      A = new Assignment(p, false);
      // console.log("asg=", A.predicate, A.val);
      const eF = this.TDSim(e_, bxp.applyAsg(A), [...asg, A], false)[0];
      const cost = this.cost(e_) + this.cost(eT) + this.cost(eF);

      const newPlan = e_.copy();
      if (eT) newPlan.appendChildTree(true, eT);
      if (eF) newPlan.appendChildTree(false, eF);
      plans.push(newPlan);

      console.log(" ************* plan ****************");
      newPlan.print();

      if (bestPlan == null || bestCost > cost) {
        bestPlan = newPlan;
      }
    }
    return [bestPlan, plans];
  }
}
