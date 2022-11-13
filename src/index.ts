import { DBMS, PlanTree, PlanTreeNode } from "./DBMS";
import { Assignment, BooleanExp, Step } from "./type";

// const b1 = BooleanExp.parse("(c > 0 AND l > 0) OR (r > 0)", "dnf");
// console.log(b1.toString());

// const asg = new Assignment(b1.predicates[0], true);
// console.log("assignment = ", asg);

// const b2 = b1.applyAsg(asg);
// console.log(b2.toString());

// const asg2 = new Assignment(b1.predicates[1], false);
// console.log("assignment = ", asg);

// const b3 = b2.applyAsg(asg2);
// console.log(b3.toString());

// (async () => {
//   const db = new DBMS();
//   console.log(await db.scan());
// })();

// const plan1 = new PlanTree([new PlanTreeNode([new Step("2")])]);
// const planChildT = new PlanTree([
//   new PlanTreeNode([new Step("3")]),
//   new PlanTreeNode([new Step("4")]),
//   new PlanTreeNode([new Step("5")]),
// ]);
// const planChildF = new PlanTree([
//   new PlanTreeNode([new Step("6")]),
//   new PlanTreeNode([new Step("7")]),
//   new PlanTreeNode([new Step("10")]),
//   new PlanTreeNode([new Step("8")]),
//   new PlanTreeNode([new Step("9")]),
//   new PlanTreeNode([new Step("11")]),
//   new PlanTreeNode([new Step("12")]),
// ]);

// plan1.appendChildTree(false, planChildT);
// plan1.appendChildTree(true, planChildF);

// console.log(plan1.arr.map((n) => n.steps));

const db = new DBMS();
const [plan, plans] = db.TDSim(
  new PlanTree([new PlanTreeNode([new Step("scanR")])]),
  BooleanExp.parse("(c > 0 AND l > 0) OR (r > 0)", "dnf"),
  [],
  true
);

// console.log("====== bestPlan ======");
// plan?.print();
// console.log(plan?.arr.map((n) => n.steps.map((s) => s.toString())));

// for (let plan of plans) {
//   console.log("**********");
//   console.log(plan.print());
//   // console.log(plan?.arr.map((n) => n.steps.map((s) => s.toString())));
// }
