export type Stmt<A> =
  | { t?: A, tag: "assign", name: string, value: Expr<A> }
  | { t?: A, tag: "expr", expr: Expr<A> }
  | { t?: A, tag: "return", value?: Expr<A> }
  | { t?: A, tag: "while", condition: Expr<A>, body: Stmt<A>[] }
  | { t?: A, tag: "if", condition?: Expr<A>, else?: Stmt<A>, body: Stmt<A>[] }
  | { t?: A, tag: "pass" }

export type Expr<A> =
  { t?: A, tag: "literal", value: Literal<A> }
  | { t?: A, tag: "id", name: string }
  | { t?: A, tag: "UnaryOp", Op: string, arg: Expr<A> }
  | { t?: A, tag: "BinaryOp", Op: string, lhs: Expr<A>, rhs: Expr<A> }
  | { t?: A, tag: "ParanthesizedExpr", arg: Expr<A> }
  | { t?: A, tag: "FuncCall", name: string, args: Expr<A>[] }

export type AssignmentType = "Definition" | "ReAssignment"

export type Type = "int" | "bool" | "none" | "any"

export type Literal<A> =
  { t?: A, tag: "None" }
  | { t?: A, tag: "True" }
  | { t?: A, tag: "False" }
  | { t?: A, tag: "number", value: number }

export type VarDef<A> =
  { t?: A, tag: VarType, name: string, value: Literal<A> }

export type VarType = "int" | "bool"

export type Parameter<A> = 
  {t?: A, name: string, tag: VarType }

export type FuncDef<A> =
  { t?: A, name: string, args: Parameter<A>[], ret: string, body: FuncBody<A> }

export type FuncBody<A> = { t?: A, definitions: VarDef<A>[], statements: Stmt<A>[] }

export type ProgramBody<A> = { t?: A, functions: FuncDef<A>[], variableDefinitions: VarDef<A>[], body: Stmt<A>[] }

export function isBinaryOp(op: string): boolean {
  return ["+", "-", "*", "%", "//", "==", "!=", "<=", ">=", "<", ">", "is"].includes(op);
}

export function isUnaryOp(op: string): boolean {
  return ["not", "-", "+"].includes(op);
}

export function BinaryOpReturnsInt(op: string): boolean {
  return ["+", "-", "//", "%", "*"].includes(op);
}

export function checkIfValidVarType(type: string): boolean {
  return ["int", "bool"].includes(type);
}