import { Stmt, Expr, VarDef, FuncDef, Literal, Parameter, ProgramBody, BinaryOpReturnsInt, Type, VarType } from "./ast";

type MasterEnv = { localEnv?: TypeEnv, globalEnv: TypeEnv }

type TypeEnv = { vars: Map<string, Type>, functions: Map<string, { args: Type[], returnType: Type }>, returnType: Type };

export function tcLiteral(literal: Literal<any>): Literal<Type> {
    switch (literal.tag) {
        case "None":
            return { ...literal, t: "none" };
        case "True":
            return { ...literal, t: "bool" };
        case "False":
            return { ...literal, t: "bool" };
        default:
            return { ...literal, t: "int" };
    }
}

export function getReturnType(type: string): Type {
    switch (type) {
        case "int":
            return "int";
        case "bool":
            return "bool";
        case "none":
            return "none";
        case "any":
            return "any";
        default:
            throw new Error(`Invalid type`); //Will never reach this part of the code
    }
}

export function convertVarTypeToType(p: VarType): Type {
    switch (p) {
        case "int":
            return "int"
        case "bool":
            return "bool"
    }
}

export function tcBody(stmts: Stmt<any>[], masterEnv: MasterEnv): [Stmt<Type>[], Type] {
    var groupReturnType: Type = "none";
    for (var i = 0; i < stmts.length; i++) {
        stmts[i] = tcStmt(stmts[i], masterEnv);
        if (stmts[i].t !== "none")
            groupReturnType = getReturnType(stmts[i].t);
    }
    return [stmts, groupReturnType];
}

export function tcWhileStatement(stmt: Stmt<any>, masterEnv: MasterEnv): Stmt<Type> {
    if (stmt.tag !== "while") throw new Error(`TypeError: Invalid while condition`);
    const checkedConditionExpression = tcExpression(stmt.condition, masterEnv);
    if (checkedConditionExpression.t !== "bool") {
        throw new Error(`TypeError: while statement cannot be evaluated with an expression which returns a non-bool value`);
    }

    const [checkedStatements, groupReturnType]: [Stmt<Type>[], Type] = tcBody(stmt.body, masterEnv);

    return { ...stmt, body: checkedStatements, condition: checkedConditionExpression, t: "none" };
}

export function tcIfStatement(stmt: Stmt<any>, masterEnv: MasterEnv): Stmt<Type> {
    if (stmt.tag !== "if") throw new Error(`TypeError: Invalid if condition`);
    if (stmt.condition !== undefined) {
        const checkedConditionExpression = tcExpression(stmt.condition, masterEnv);
        if (checkedConditionExpression.t !== "bool") {
            throw new Error(`TypeError: If/Elif cannot be evaluated with an expression which returns a non-bool value`);
        }
        stmt.condition = checkedConditionExpression;
    }
    if (stmt.else !== undefined) {
        const checkedIfStatement = tcStmt(stmt.else, masterEnv);
        stmt.else = checkedIfStatement;
    }

    const [checkedStatements, groupReturnType]: [Stmt<Type>[], Type] = tcBody(stmt.body, masterEnv);
    stmt.body = checkedStatements;

    if (stmt.else === undefined && stmt.condition !== undefined) {
        stmt.t = getReturnType("none");
    }
    else if (stmt.else === undefined && stmt.condition === undefined) {
        stmt.t = groupReturnType;
    }
    else if (stmt.else !== undefined && stmt.condition !== undefined) {
        if (groupReturnType !== "none" && stmt.else.t !== "none") {
            stmt.t = groupReturnType;
        }
        else if (groupReturnType === "none" || stmt.else.t === "none") {
            stmt.t = getReturnType("none");
        }
        else { //Will never reach this piece of code, return types are matched with the return types of the local environment
            throw new Error(`TypeError: Multiple return types inside the localEnv`);
        }
    }
    else { //Will never reach this piece of code, invalid if conditions are caught by the parser
        throw new Error(`TypeError: Invalid If condition`);
    }
    return stmt;
}

export function tcStmt(stmt: Stmt<any>, masterEnv: MasterEnv): Stmt<Type> {
    const localEnv: TypeEnv = masterEnv.localEnv;
    const globalEnv: TypeEnv = masterEnv.globalEnv;
    switch (stmt.tag) {
        case "assign":
            //If the variable is only declared globally and has not been redefined inside the localEnv
            if (globalEnv.vars.has(stmt.name) && localEnv !== undefined && !localEnv.vars.has(stmt.name)) {
                throw new Error(`TypeError: cannot assign to ${stmt.name} explicitly not declared in the scope`);
            }
            //If the variable is not declared globally and either we are at the outermost level or we have a local environment 
            //and the variable has not been declared in the local environment either
            if (!globalEnv.vars.has(stmt.name) && (localEnv === undefined || (!localEnv.vars.has(stmt.name)))) {
                throw new Error(`TypeError: Undefined variable ${stmt.name}`);
            }
            const assignedExpression = tcExpression(stmt.value, masterEnv);
            const variableType = (globalEnv.vars.has(stmt.name)) ? globalEnv.vars.get(stmt.name) : (localEnv.vars.get(stmt.name));
            if (assignedExpression.t !== variableType) {
                throw new Error(`TypeError: Cannot assign expression of type ${assignedExpression.t} to ${variableType}`);
            }
            return { ...stmt, t: "none", value: assignedExpression };
        case "expr":
            var checkedExpression = tcExpression(stmt.expr, masterEnv);
            return { ...stmt, expr: checkedExpression, t: "none" };
        case "return":
            if (localEnv === undefined) {
                throw new Error(`TypeError: Returns cannot occur at the outermost level`);
            }
            if (stmt.value === undefined) {
                return { t: "none", ...stmt };
            }
            var checkedExpression = tcExpression(stmt.value, masterEnv);
            if (localEnv.returnType !== checkedExpression.t) {
                throw new Error(`TypeError: Expected a return of type ${localEnv.returnType}, but got ${checkedExpression.t}`);
            }
            return { ...stmt, value: checkedExpression, t: checkedExpression.t };
        case "while":
            return tcWhileStatement(stmt, masterEnv);
        case "if":
            return tcIfStatement(stmt, masterEnv);
        case "pass":
            return { ...stmt, t: "none" };
    }
}

export function checkIfBuiltInFunction(f: FuncDef<any>): boolean {
    return ["print", "abs", "min", "max", "pow"].includes(f.name);
}

export function shallowGetFuncDetails(f: FuncDef<any>, masterEnv: MasterEnv): FuncDef<Type> {
    const argTypes: Type[] = f.args.map(x => { return convertVarTypeToType(x.tag); });
    const funcRetType: Type = getReturnType(f.ret);

    //Functions are always added to the global env as we do not support nested functions
    if (checkIfBuiltInFunction(f)) {
        throw new Error(`TypeError: Function ${f.name} is a builtin function and cannot be redefined`);
    }
    else if (masterEnv.globalEnv.functions.has(f.name)) {
        throw new Error(`TypeError: Duplicate definition of function ${f.name} `);
    }

    if ((masterEnv.localEnv !== undefined && masterEnv.localEnv.vars.has(f.name)) || (masterEnv.globalEnv.vars.has(f.name))) {
        throw new Error(`TypeError: Variable with name ${f.name} already exists`);
    }
    masterEnv.globalEnv.functions.set(f.name, { args: argTypes, returnType: funcRetType });

    return { ...f, t: funcRetType };
}

export function tcVarDef(v: VarDef<any>, masterEnv: MasterEnv): VarDef<Type> {
    const varType: Type = convertVarTypeToType(v.tag);
    const typeCheckedLiteral = tcLiteral(v.value);

    if (typeCheckedLiteral.t !== varType) {
        throw new Error(`TypeError: Cannot assign ${typeCheckedLiteral.t} to ${varType}`);
    }
    if (masterEnv.localEnv === undefined && masterEnv.globalEnv.functions.has(v.name)) {
        throw new Error(`TypeError: ${v.name} has already been defined as a function`);
    }
    if ((masterEnv.localEnv !== undefined && masterEnv.localEnv.vars.has(v.name)) 
    || (masterEnv.localEnv === undefined && masterEnv.globalEnv.vars.has(v.name))) {
        throw new Error(`TypeError: Duplicate definition of ${v.name}`);
    }

    if (masterEnv.localEnv !== undefined) {
        masterEnv.localEnv.vars.set(v.name, varType);
    }
    else {
        masterEnv.globalEnv.vars.set(v.name, varType);
    }
    return { ...v, t: varType, value: typeCheckedLiteral };
}

export function tcParameter(p: Parameter<any>, masterEnv: MasterEnv): Parameter<Type> {
    p.t = convertVarTypeToType(p.tag);

    masterEnv.localEnv.vars.set(p.name, p.t);

    return p;
}

export function tcFuncDef(f: FuncDef<Type>, masterEnv: MasterEnv): FuncDef<Type> {
    masterEnv.localEnv = { vars: new Map<string, Type>(), functions: new Map<string, { args: Type[], returnType: Type }>(), returnType: f.t };
    const typeCheckedParams: Parameter<Type>[] = f.args.map(p => { return tcParameter(p, masterEnv); });
    f.args = typeCheckedParams;
    const typeCheckedVarDefs: VarDef<Type>[] = f.body.definitions.map(v => { return tcVarDef(v, masterEnv) });
    f.body.definitions = typeCheckedVarDefs;
    const [checkedStatements, bodyReturnType]: [Stmt<Type>[], Type] = tcBody(f.body.statements, masterEnv);
    f.body.statements = checkedStatements;
    f.body.t = bodyReturnType;
    if (f.body.t != f.t) {
        if (f.t === "none") {
            throw new Error(`TypeError: Function ${f.name} does not have a return type`);
        }
        else {
            if (f.body.t === "none") {
                throw new Error(`TypeError: Function ${f.name} should have a return at possible reachable code segments in the function`);
            }
            else {
                throw new Error(`TypeError: Function ${f.name} returns ${f.t}, but got ${f.body.t}`);
            }
        }
    }

    delete masterEnv['localEnv'];

    return f;
}

export function tcExpression(expression: Expr<any>, masterEnv: MasterEnv): Expr<Type> {
    const localEnv: TypeEnv = masterEnv.localEnv;
    const globalEnv: TypeEnv = masterEnv.globalEnv;
    switch (expression.tag) {
        case "literal":
            const nliteral: Literal<Type> = tcLiteral(expression.value);
            return { ...expression, t: nliteral.t, value: nliteral };
        case "id":
            if ((localEnv === undefined || !localEnv.vars.has(expression.name)) && (!globalEnv.vars.has(expression.name)))
                throw new Error(`TypeError: Undefined variable ${expression.name}`);
            const expressionType = 
                getReturnType(localEnv !== undefined && localEnv.vars.has(expression.name) 
                ? localEnv.vars.get(expression.name) : globalEnv.vars.get(expression.name));
            return { ...expression, t: expressionType };
        case "UnaryOp":
            var narg: Expr<Type> = tcExpression(expression.arg, masterEnv);
            switch (expression.Op) {
                case "not":
                    if (narg.t !== "bool") throw new Error('TypeError: \"not\" operation is not defined on type ' + narg.t);
                    return { ...expression, t: "bool", arg: narg };
                case "+":
                    if (narg.t !== "int") throw new Error('TypeError: \"+\" operation is not defined on type ' + narg.t);
                    return { ...expression, t: "int", arg: narg };
                case "-":
                    if (narg.t !== "int") throw new Error('TypeError: \"-\" operation is not defined on type ' + narg.t);
                    return { ...expression, t: "int", arg: narg };
                default:
                    throw new Error("TypeError: Undefined Unary Operation " + expression.Op);
            }
        case "BinaryOp":
            var nlhs: Expr<Type> = tcExpression(expression.lhs, masterEnv);
            var nrhs: Expr<Type> = tcExpression(expression.rhs, masterEnv);
            const exprReturnType = getReturnType(BinaryOpReturnsInt(expression.Op) ? "int" : "bool");
            if (nlhs.t !== nrhs.t) {
                throw new Error(`TypeError: Cannot apply ${expression.Op} on ${nlhs.t} and ${nrhs.t}`);
            }
            else if (nlhs.t == "int") {
                if (expression.Op == "is") throw new Error(`TypeError: Cannot apply is operator on ${nlhs.t} and ${nrhs.t}`);
                return { ...expression, lhs: nlhs, rhs: nrhs, t: exprReturnType };
            }
            else if (nrhs.t == "bool") {
                if (!["==", "!="].includes(expression.Op)) throw new Error(`TypeError: Cannot apply ${expression.Op} on ${nlhs.t} and ${nrhs.t}`);
                return { ...expression, lhs: nlhs, rhs: nrhs, t: exprReturnType };
            }
            if (!["is"].includes(expression.Op)) throw new Error(`TypeError: Cannot apply ${expression.Op} on None and None`);
            return { ...expression, lhs: nlhs, rhs: nrhs, t: exprReturnType };
        case "ParanthesizedExpr":
            var narg = tcExpression(expression.arg, masterEnv);
            return { ...expression, arg: narg, t: getReturnType(narg.t) };
        case "FuncCall":
            if (!globalEnv.functions.has(expression.name)) {
                throw new Error(`TypeError: Undefined Function ${expression.name}`);
            }
            var returnType: string;
            var argTypes: string[];
            if (localEnv !== undefined && localEnv.functions.has(expression.name)) {
                returnType = localEnv.functions.get(expression.name).returnType;
                argTypes = localEnv.functions.get(expression.name).args;
            }
            else {
                returnType = globalEnv.functions.get(expression.name).returnType;
                argTypes = globalEnv.functions.get(expression.name).args;
            }

            if (argTypes.length !== expression.args.length) {
                throw new Error(`TypeError: Expected ${argTypes.length} number of parameters, but got ${expression.args.length}`);
            }
            expression.args.forEach((arg) => {
                arg = tcExpression(arg, masterEnv);
            });
            for (var i: number = 0; i < expression.args.length; i++) {
                expression.args[i] = tcExpression(expression.args[i], masterEnv);
                if (expression.args[i].t !== argTypes[i] && argTypes[i] !== "any")
                    throw new Error(`TypeError: Expected ${argTypes[i]} as the ${i}-th parameter, but got ${expression.args[i].t}`);
            }
            return { ...expression, t: getReturnType(returnType) };
        default:
            throw new Error("TypeError: Expression not recognized");
    }
}

export function addBuiltinFunctions(masterEnv: MasterEnv) {
    masterEnv.globalEnv.functions.set("print", { args: ["any"], returnType: "none" });
    masterEnv.globalEnv.functions.set("abs", { args: ["int"], returnType: "int" });
    masterEnv.globalEnv.functions.set("min", { args: ["int", "int"], returnType: "int" });
    masterEnv.globalEnv.functions.set("max", { args: ["int", "int"], returnType: "int" });
    masterEnv.globalEnv.functions.set("pow", { args: ["int", "int"], returnType: "int" });
}

export function tcProgram(pgm: ProgramBody<any>): ProgramBody<any> {
    var masterEnv: MasterEnv = { globalEnv: { vars: new Map<string, Type>(), functions: new Map<string, { args: Type[], returnType: Type }>(), returnType: "none" } };

    addBuiltinFunctions(masterEnv);

    pgm.variableDefinitions = pgm.variableDefinitions.map(v => { return tcVarDef(v, masterEnv); });
    pgm.functions = pgm.functions.map(f => { return shallowGetFuncDetails(f, masterEnv); });

    pgm.functions = pgm.functions.map(f => { return tcFuncDef(f, masterEnv); });

    const [typeCheckedBody, _returnType] = tcBody(pgm.body, masterEnv);
    pgm.body = typeCheckedBody;

    return pgm;
}