import { parser } from "lezer-python";
import { Tree, TreeCursor } from "lezer-tree";
import { VarType, Stmt, Expr, AssignmentType, VarDef, FuncBody, FuncDef, Literal, Parameter, ProgramBody, isBinaryOp, isUnaryOp, checkIfValidVarType } from "./ast";
import { getToken } from "./helper";

function throwErrorIfNextSibling(c: TreeCursor){
  if (c.nextSibling())
    throw new Error(`ParseError: Invalid expression`);
}

export function identifyAssignmentType(c: TreeCursor, s: string) {
  if (c.node.type.name !== "AssignStatement") {
    throw new Error("ParseError: Not an assignment statement");
  }
  c.firstChild();
  c.nextSibling();
  switch (c.type.name) {
    case "TypeDef":
      c.parent();
      return "Definition";
    case "AssignOp":
      c.parent();
      return "ReAssignment";
    default:
      throw new Error("ParseError: Invalid assignment statement");
  }
}

export function parseLiteral(c: TreeCursor, s: string): Literal<any> {
  switch (c.node.type.name) {
    case "Number":
      return { tag: "number", value: Number(getToken(c, s)) };
    case "Boolean":
      switch (getToken(c, s)) {
        case "True":
          return { tag: "True" };
        case "False":
          return { tag: "False" };
      }
    case "None":
      return { tag: "None" };
    default:
      throw new Error("ParseError: Invalid Literal " + getToken(c, s));
  }
}

export function parseVariableDefinition(c: TreeCursor, s: string): VarDef<any> {
  c.firstChild();
  const variableName = getToken(c, s);
  c.nextSibling();
  c.firstChild();
  c.nextSibling();
  const variableType = getToken(c, s);
  c.parent();
  c.nextSibling();
  c.nextSibling();
  const literalVal = parseLiteral(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  switch (variableType) {
    case "int":
      return { tag: "int", name: variableName, value: literalVal };
    case "bool":
      return { tag: "bool", name: variableName, value: literalVal };
    default:
      throw new Error("ParseError: Invalid Variable Type");
  }
}

export function getParamType(type: string): VarType {
  switch(type){
    case "int":
      return "int";
    case "bool":
      return "bool";
    default:
      throw new Error("ParseError: Invalid parameter type");
  }
}

export function parseParamList(c: TreeCursor, s: string) {
  var paramList: Parameter<any>[] = [];
  if (c.type.name !== "ParamList") throw new Error("ParseError: Invalid Param List");
  c.firstChild();
  if (getToken(c, s) !== "(") throw new Error("ParseError: Invalid Param List");
  c.nextSibling();
  while (getToken(c, s) !== ")") {
    if (c.node.type.name !== "VariableName") throw new Error("ParseError: Invalid param " + getToken(c, s));
    const varName = getToken(c, s);
    c.nextSibling();
    if (c.type.name.toString() !== "TypeDef") throw new Error("ParseError: Invalid typeless variable " + varName);
    c.firstChild();
    c.nextSibling();
    const variableType = getToken(c, s);
    c.parent();
    if (["int", "bool"].includes(variableType)) {
      paramList.push({ tag: getParamType(variableType), name: varName });
    }
    else {
      throw new Error("ParseError: Invalid return type");
    }
    c.nextSibling();
    if (getToken(c, s) === ",") {
      const nextSiblingStatus = c.nextSibling();
      if (!nextSiblingStatus || getToken(c, s) == ")") throw new Error(`ParseErrorError: Invalid Param list`);
    }
    else if (getToken(c, s) !== ")") throw new Error("ParseError: Invalid Param List");
  }
  throwErrorIfNextSibling(c);
  c.parent();
  return paramList;
}

export function parseFunctionBody(c: TreeCursor, s: string) {
  c.firstChild();
  var definitions: VarDef<any>[] = [];
  var statements: Stmt<any>[] = [];
  var definitionPhase: boolean = true;
  while (c.nextSibling()) { //Initially moves to the body skipping :
    if (!definitionPhase && (c.type.name === "AssignStatement") && identifyAssignmentType(c, s) === "Definition")
      throw new Error("ParseError: Cannot define any further variables inside the function body");
    definitionPhase = !((c.type.name === "AssignStatement" && identifyAssignmentType(c, s) === "ReAssignment") || (c.type.name !== "AssignStatement"));
    if (definitionPhase) {
      definitions.push(parseVariableDefinition(c, s));
    }
    else {
      statements.push(traverseStmt(c, s));
    }
  }
  throwErrorIfNextSibling(c);
  c.parent();
  return { definitions: definitions, statements: statements };
}

export function parseFunctionDefinition(c: TreeCursor, s: string) {
  var funcReturnType = "none";
  c.firstChild();
  if (getToken(c, s) !== "def") throw new Error("ParseError: FunctionDef incorrect");
  c.nextSibling();
  const functionName = getToken(c, s);
  console.log("Function name - " + functionName);
  c.nextSibling();
  var parameters = parseParamList(c, s);
  console.log("Parameter list - " + JSON.stringify(parameters));
  c.nextSibling();
  if (c.node.type.name === "TypeDef") {
    c.firstChild();
    funcReturnType = getToken(c, s);
    if (!["int", "bool"].includes(funcReturnType)) throw new Error("ParseError: Invalid function typedef");
    c.parent();
    c.nextSibling();
  }
  if (c.node.type.name !== "Body") throw new Error("ParseError: Invalid Function definition");
  const functionBody = parseFunctionBody(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { name: functionName, ret: funcReturnType, args: parameters, body: functionBody };
}

export function parseVariableAssignment(c: TreeCursor, s: string): Stmt<any> {
  c.firstChild();
  const variableName = getToken(c, s);
  c.nextSibling();
  c.nextSibling();
  const assignedExpression = traverseExpr(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "assign", name: variableName, value: assignedExpression };
}

export function parseReturnStatement(c: TreeCursor, s: string): Stmt<any> {
  c.firstChild();
  const nextSiblingStatus = c.nextSibling();
  if (nextSiblingStatus == false || getToken(c, s).length === 0){
    c.parent();
    return { tag: "return" };
  }
  const traversedExpression = traverseExpr(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "return", value: traversedExpression };
}

export function parseBinaryExpression(c: TreeCursor, s: string): Expr<any> {
  c.firstChild();
  const lhs = traverseExpr(c, s);
  c.nextSibling();
  const operation = getToken(c, s);
  if (!isBinaryOp(operation)) throw new Error("ParseError: Invalid Binary Operand ${operation}");
  c.nextSibling();
  const rhs = traverseExpr(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "BinaryOp", lhs: lhs, rhs: rhs, Op: operation };
}

export function parseWhileIfBody(c: TreeCursor, s: string): Stmt<any>[] {
  c.firstChild();
  const statements: Stmt<any>[] = [];
  while (c.nextSibling()) statements.push(traverseStmt(c, s)); //First nextSibling moves into the actual body skipping :
  throwErrorIfNextSibling(c);
  c.parent();
  return statements;
}

export function parseWhileStatement(c: TreeCursor, s: string): Stmt<any> {
  c.firstChild();
  c.nextSibling();
  const whileConditionExpression = traverseExpr(c, s);
  c.nextSibling();
  if (c.type.name !== "Body") throw new Error("ParseError: Missing body for while statement");
  var statements: Stmt<any>[] = parseWhileIfBody(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "while", condition: whileConditionExpression, body: statements };
}

export function processIfStatementNode(c: TreeCursor, s: string): Stmt<any> {
  if (c.type.name !== "IfStatement") throw new Error("ParseError: Invalid If statement");
  c.firstChild();
  const parsedIfStatement = parseIfStatement(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return parsedIfStatement;
}

export function parseIfStatement(c: TreeCursor, s: string): Stmt<any> {
  const if_type = getToken(c, s);
  c.nextSibling();
  var conditionExpression: Expr<any>;
  if (if_type !== "else") {
    conditionExpression = traverseExpr(c, s);
    c.nextSibling();
  }
  if (c.type.name !== "Body") throw new Error("ParseError: If condition missing body");
  const statements = parseWhileIfBody(c, s);
  if (if_type == "else") {
    if (c.nextSibling()) throw new Error("ParseError: No conditions allowed after else");
    return { tag: "if", body: statements };
  }
  if (c.nextSibling()) {
    var nextIf: Stmt<any> = parseIfStatement(c, s);
    return { tag: "if", condition: conditionExpression, else: nextIf, body: statements };
  }
  return { tag: "if", condition: conditionExpression, body: statements };
}

export function parseUnaryExpression(c: TreeCursor, s: string): Expr<any> {
  c.firstChild();
  const operation = getToken(c, s);
  if (!isUnaryOp(operation)) throw new Error("ParseError: Invalid Unary Operand ${operation}");
  c.nextSibling();
  const expression = traverseExpr(c, s);
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "UnaryOp", Op: operation, arg: expression };
}

export function parseParenthesizedExpression(c: TreeCursor, s: string): Expr<any> {
  c.firstChild();
  if (getToken(c, s) !== "(") throw new Error("ParseError: Invalid Paranthesis");
  c.nextSibling();
  const traversedExpression = traverseExpr(c, s);
  c.nextSibling();
  if (getToken(c, s) !== ")") throw new Error("ParseError: Invalid Paranthesis");
  throwErrorIfNextSibling(c);
  c.parent();
  return { tag: "ParanthesizedExpr", arg: traversedExpression };
}

export function parseFunctionCall(c: TreeCursor, s: string): Expr<any> {
  c.firstChild();
  const callName = getToken(c, s);
  var argList: Expr<any>[] = [];
  c.nextSibling(); // go to arglist
  // console.log("As part of parsing the expression 1 at " + s.substring(c.from, c.to));
  c.firstChild(); //Open bracket
  c.nextSibling(); //First argument expression
  // console.log("Supposedly the first argument expression " + s.substring(c.from, c.to));
  while (getToken(c, s) !== ')') {
    argList.push(traverseExpr(c, s));
    c.nextSibling();
    if (getToken(c, s) == ','){ 
      const nextSiblingStatus = c.nextSibling();
      if (!nextSiblingStatus || getToken(c, s) == ")") throw new Error(`ParseErrorError: Invalid parameter list`);
    }
  }
  throwErrorIfNextSibling(c);
  c.parent(); //Pop ArgList
  throwErrorIfNextSibling(c);
  c.parent(); //Post Expression
  return { tag: "FuncCall", args: argList, name: callName };
}

export function traverseExpr(c: TreeCursor, s: string): Expr<any> {
  switch (c.type.name) {
    case "Number":
      return {
        tag: "literal",
        value: parseLiteral(c, s)
      }
    case "Boolean":
      return {
        tag: "literal",
        value: parseLiteral(c, s)
      }
    case "None":
      return {
        tag: "literal",
        value: parseLiteral(c, s)
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "BinaryExpression":
      return parseBinaryExpression(c, s);
    case "UnaryExpression":
      return parseUnaryExpression(c, s);
    case "ParenthesizedExpression":
      return parseParenthesizedExpression(c, s);
    case "CallExpression":
      return parseFunctionCall(c, s);
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to) + " with node type " + c.type.name + " / ParseError");
  }
}

export function traverseStmt(c: TreeCursor, s: string): Stmt<any> {
  switch (c.node.type.name) {
    case "AssignStatement":
      if (identifyAssignmentType(c, s) === "Definition") throw new Error("ParseError: Cannot define variable " + getToken(c, s) + " at this point");
      return parseVariableAssignment(c, s);
    case "ExpressionStatement":
      c.firstChild();
      // const expr_string = s.substring(c.from, c.to); //Storing the expression string for comparison at a later stage
      const expr = traverseExpr(c, s);
      throwErrorIfNextSibling(c);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    case "ReturnStatement":
      return parseReturnStatement(c, s);
    case "WhileStatement":
      return parseWhileStatement(c, s);
    case "IfStatement":
      return processIfStatementNode(c, s);
    case "PassStatement":
      return { tag: "pass" }
    default:
      throw new Error("ParseError: Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to) + " with node type " + c.node.type.name);
  }
}

export function traverse(c: TreeCursor, s: string): ProgramBody<any> {
  switch (c.node.type.name) {
    case "Script":
      const stmts = [];
      const funcDefs = [];
      const varDefs = [];
      var definitionPhase: boolean = true;
      c.firstChild();
      do {
        if (!definitionPhase && ((c.type.name === "AssignStatement" && identifyAssignmentType(c, s) == "Definition") || (c.type.name === "FunctionDefinition")))
          throw new Error("Parse Error: Definition at the wrong location");
        definitionPhase = ((c.type.name === "AssignStatement" && identifyAssignmentType(c, s) == "Definition") || (c.type.name === "FunctionDefinition"));
        if (definitionPhase) {
          if (c.type.name === "FunctionDefinition") {
            funcDefs.push(parseFunctionDefinition(c, s));
          }
          else {
            varDefs.push(parseVariableDefinition(c, s));
          }
        }
        else {
          stmts.push(traverseStmt(c, s));
        }
      } while (c.nextSibling())
      console.log("Parsed variable definitions = " + varDefs.length + " | FunctionDefinitions = " + funcDefs.length + " | variable Definitions = " + varDefs.length);
      return { functions: funcDefs, variableDefinitions: varDefs, body: stmts };
    default:
      throw new Error("ParseError: Could not parse program at " + c.node.from + " " + c.node.to);
  }
}

export function parse(source: string): ProgramBody<any> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}