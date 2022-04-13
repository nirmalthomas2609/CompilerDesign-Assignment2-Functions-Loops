import { Stmt, Expr, Type, FuncDef, Parameter, VarDef, ProgramBody } from "./ast";
import { parse } from "./parser";
import { tcProgram } from "./tc";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;

type CompileResult = {
  wasmSource: string,
};

type Counter = {val: number}

function codeGenParams(params: Parameter<any>[]): Array<string> {
  const paramCommands: string[] = params.map(p => {
    return `(param $${p.name} i32)`;
  });
  return paramCommands;
}

function codeGenFuncReturnType(RetType: Type): Array<string> {
  switch(RetType){
    case "none":
      return [];
    case "int":
      return [`(result i32)`];
    case "bool":
      return [`(result i32)`];
    default: //Will never reach this default condition as return type of functions are validated by the type checker
      throw new Error(`TypeError: Invalid return type for the function`);
  }
}

function codeGenVarDefs(vars: VarDef<any>[], isGlobal: boolean): Array<string> {
  if (!isGlobal){
    const varDefCommands: string[] = vars.map(v => { return `(local $${v.name} i32)`;});
    const varInitCommands: string[]  = vars.map(v => {
      switch(v.tag){
        case "int":
          if (v.value.tag !== "number") throw new Error(); //Will never be executed as sanity check done by type checker
          return `(i32.const ${v.value.value})\n(local.set $${v.name})`;
        case "bool":
          if (v.value.tag !== "True" && v.value.tag !== "False") throw new Error(); //Will never be executed as sanity check done by type checker
          const boolVal = v.value.tag === "True" ? 1:0;
          return `(i32.const  ${boolVal})\n(local.set $${v.name})`;
      }
    });
    return [...varDefCommands, ...varInitCommands];
  }
  else{
    const varDefCommands: string[] = vars.map(v => {
      switch(v.tag){
        case "int":
          if (v.value.tag !== "number") throw new Error(); //Will never be executed as sanity check done by type checker
          return `(global $${v.name} (mut i32) (i32.const ${v.value.value}))`;
        case "bool":
          if (v.value.tag !== "True" && v.value.tag !== "False") throw new Error(); //Will never be executed as sanity check done by type checker
          const boolVal = v.value.tag === "True" ? 1:0;
          return `(global $${v.name} (mut i32) (i32.const ${boolVal}))`;
      }
    });
    return varDefCommands;
  }
}

function getLocalVarsFromFunc(f: FuncDef<Type>): string[]{
  var localVars: string[] = [];
  for (var i = 0; i < f.args.length; i++){
    localVars.push(f.args[i].name);
  }
  for(var i = 0; i < f.body.definitions.length; i++){
    localVars.push(f.body.definitions[i].name);
  }
  return localVars;
}

function codeGenFuncDef(f: FuncDef<Type>): Array<string>{
  var loopCounter: Counter = {val: 1};
  var localVars: string[] = getLocalVarsFromFunc(f);
  const funcBodyCommands: string[] = codeGenBody(f.body.statements, localVars, loopCounter);
  const funcParamCommands: string[] = codeGenParams(f.args);
  const funcVarDefCommands: string[] = codeGenVarDefs(f.body.definitions, false);
  // const funcRetTypeCommands: string[] = codeGenFuncReturnType(f.t);
  const funcRetTypeCommands: string[] = [`(result i32)`];
  var funcReturnCommands: string[] = [`(i32.const 0)`, `(return)`];
  return [
    `(func $${f.name}`,
    ...funcParamCommands,
    ...funcRetTypeCommands,
    `(local $$scratch i32)`,
    ...funcVarDefCommands,
    ...funcBodyCommands,
    ...funcReturnCommands,
    `)`
  ];
}

function codeGenBody(stmts: Stmt<any>[], localVars: string[], loop_counter: Counter): Array<string>{
  var bodyCommands: string[] = [];
  for (var i = 0; i < stmts.length; i++){
    bodyCommands = [...bodyCommands, ...codeGenStmt(stmts[i], localVars, loop_counter)];
  }
  return bodyCommands;
}

function codeGenStmt(stmt: Stmt<any>, localVars: string[], loop_counter: Counter): Array<string>{
  switch(stmt.tag){
    case "assign":
      var expr_commands = codeGenExpr(stmt.value, localVars);
      const scopeKeyword = localVars.includes(stmt.name) ? "local" : "global";
      return [...expr_commands, `(${scopeKeyword}.set $${stmt.name})`];
    case "expr":
      var expr_commands = codeGenExpr(stmt.expr, localVars);
      return [...expr_commands, `(local.set $$scratch)`];
    case "return":
      if (stmt.value === undefined){
        return [];
      }
      var expr_commands = codeGenExpr(stmt.value, localVars);
      return [...expr_commands, `(return)`];
    case "pass":
      return [];
    case "while":
      var conditionCommands = codeGenExpr(stmt.condition, localVars);
      var bodyCommands: string[] = codeGenBody(stmt.body, localVars, loop_counter);
      const whileCommands = [
        `(block $$block_label_${loop_counter.val}`,
        `(loop $$loop_label_${loop_counter.val}`, 
        ...conditionCommands, 
        `(i32.const 1)`, 
        `(i32.xor)`, 
        `(br_if $$block_label_${loop_counter.val})`, 
        ...bodyCommands,
        `(br $$loop_label_${loop_counter.val})`,
        `)`, 
        `)`
      ];
      loop_counter.val++;
      return whileCommands;
    case "if":
      if (stmt.condition === undefined && stmt.else === undefined){
        return codeGenBody(stmt.body, localVars, loop_counter);
      }
      //If then else is defined, then there has to be an expression
      const exprCommands = codeGenExpr(stmt.condition, localVars);
      const ifBodyCommands = codeGenBody(stmt.body, localVars, loop_counter);
      if (stmt.else === undefined){
        return [
          ...exprCommands,
          `(if`,
          `(then`,
          ...ifBodyCommands,
          `)`,
          `)`
        ];
      }
      else{
        const elseBodyCommands = codeGenStmt(stmt.else, localVars, loop_counter);
        return [
          ...exprCommands,
          `(if`,
          `(then`,
          ...ifBodyCommands,
          `)`,
          `(else`,
          ...elseBodyCommands,
          `)`,
          `)`
        ];
      }
  }
}

function explicitModeCommandsPrint(expr: Expr<Type>): Array<string>{
  if (expr.tag !== "FuncCall") throw new Error(`CompileError: Invalid function call print`); //Will never be executed, for the compiler
  const argExpr = expr.args[0];
  switch(argExpr.t){
    case "int":
      return [`(i32.const 2)`];
    case "bool":
      return [`(i32.const 1)`];
    case "none":
      return [`(i32.const 0)`];
    default:
      return [`(i32.const 2)`];
  }
}

function codeGenExpr(expr: Expr<any>, localVars: string[]): Array<string>{
  switch(expr.tag){
    case "literal":
      const literal = expr.value;
      switch(literal.tag){
        case "None":
          return ["(i32.const 0)"];
        case "True":
          return ["(i32.const 1)"];
        case "False":
          return ["(i32.const 0)"];
        case "number":
          return ["(i32.const " + literal.value + ")"];
      }
    case "id":
      if (localVars.includes(expr.name)){
        return [`(local.get $${expr.name})`];
      }
      return [`(global.get $${expr.name})`];
    case "UnaryOp":
      const expr_commands = codeGenExpr(expr.arg, localVars);
      switch(expr.Op){
        case "not":
          return [...expr_commands, '(i32.const 1)', '(i32.xor)']
        case "+":
          return expr_commands;
        case "-":
          return [...expr_commands, '(i32.const -1)', '(i32.mul)'];
        default: //Will never get to this point, as undefined unary operations are checked using the type checker
          throw new Error(`TypeError: Undefined Unary Operation`);
      }
    case "BinaryOp":
      const lhs_commands = codeGenExpr(expr.lhs, localVars);
      const rhs_commands = codeGenExpr(expr.rhs, localVars);
      const OpCode = codeGenBinOperation(expr.Op);
      return [...lhs_commands, ...rhs_commands, ...OpCode];
    case "ParanthesizedExpr":
      return codeGenExpr(expr.arg, localVars);
    case "FuncCall":
      var funcCallStatements: string[] = [];
      for(var i = 0; i < expr.args.length; i++){
        const arg = expr.args[i];
        funcCallStatements = [...funcCallStatements, ...codeGenExpr(arg, localVars)];
      }
      //Special case for print - To handle printing the literals exactly in case of None types and boolean types
      if (expr.name === "print"){
        funcCallStatements = [...funcCallStatements, ...explicitModeCommandsPrint(expr)];
      }
      funcCallStatements = [...funcCallStatements, `(call $${expr.name})`];
      return funcCallStatements;
  
  }
}

function codeGenBinOperation(operation: string) : Array<string> {
  switch(operation) {
    case "+":
      return ["(i32.add)"];
    case "-":
      return ["(i32.sub)"];
    case "*":
      return ["(i32.mul)"];
    case "//":
      return [("i32.div_s")];
    case "%":
      return ["(i32.rem_s)"];
    case "==":
      return ["(i32.eq)"];
    case "!=":
      return ["(i32.ne)"];
    case ">":
      return ["(i32.gt_s)"];
    case "<":
      return ["(i32.lt_s)"];
    case ">=":
      return ["(i32.ge_s)"];
    case "<=":
      return ["(i32.le_s)"];
    case "is":
      return ["(i32.eq)"];
    default:
      throw new Error("CompileError: Unrecognized binary operator -> " + operation);
  }
}

function CodeGenProgram(pgm: ProgramBody<any>): Array<string>{
  const loopCounter: Counter = {val: 1};

  const varDefCommands: string[] = codeGenVarDefs(pgm.variableDefinitions, true);
  var funcDefCommands: string[] = [];
  for(var i = 0; i < pgm.functions.length; i++){
    funcDefCommands = [...funcDefCommands, ...codeGenFuncDef(pgm.functions[i])];
  }
  const bodyCommands = codeGenBody(pgm.body, [], loopCounter);
  return [
    `(module`,
    `(func $print (import "imports" "print") (param i32) (param i32) (result i32))`,
    `(func $min (import "imports" "min") (param i32) (param i32) (result i32))`,
    `(func $abs (import "imports" "abs") (param i32) (result i32))`,
    `(func $max (import "imports" "max") (param i32) (param i32) (result i32))`,
    `(func $pow (import "imports" "pow") (param i32) (param i32) (result i32))`,
    ...varDefCommands,
    ...funcDefCommands,
    `(func (export "exported_func")`,
    `(local $$scratch i32)`,
    ...bodyCommands,
    `)`,
    `)`
  ];
}

export function compile(source: string): string{
  const parsedOutput = parse(source);
  console.log("Parsed output - ", JSON.stringify(parsedOutput, null, 2));
  const tcOutput = tcProgram(parsedOutput);
  return CodeGenProgram(tcOutput).join("\n");
}