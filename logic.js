/**
 * AI Logic Theorem Solver Core Engine
 */

class LogicNode {
    constructor(type, value = null, children = []) {
        this.type = type;
        this.value = value;
        this.children = children;
    }

    toString() {
        if (this.type === 'variable') return this.value;
        if (this.type === 'not') return `~${this.children[0].toString()}`;
        if (this.type === 'and') return `(${this.children[0].toString()} & ${this.children[1].toString()})`;
        if (this.type === 'or') return `(${this.children[0].toString()} | ${this.children[1].toString()})`;
        if (this.type === 'implies') return `(${this.children[0].toString()} => ${this.children[1].toString()})`;
        if (this.type === 'iff') return `(${this.children[0].toString()} <=> ${this.children[1].toString()})`;
        return '';
    }
}

class LogicEngine {
    constructor() {
        this.cnfSteps = [];
    }

    // --- Parser ---
    parse(input) {
        const tokens = this.tokenize(input);
        let pos = 0;

        const parseIff = () => {
            let node = parseImplies();
            while (pos < tokens.length && tokens[pos].type === 'iff') {
                pos++;
                node = new LogicNode('iff', null, [node, parseIff()]);
            }
            return node;
        };

        const parseImplies = () => {
            let node = parseOr();
            while (pos < tokens.length && tokens[pos].type === 'implies') {
                pos++;
                node = new LogicNode('implies', null, [node, parseImplies()]);
            }
            return node;
        };

        const parseOr = () => {
            let node = parseAnd();
            while (pos < tokens.length && tokens[pos].type === 'or') {
                pos++;
                node = new LogicNode('or', null, [node, parseAnd()]);
            }
            return node;
        };

        const parseAnd = () => {
            let node = parseNot();
            while (pos < tokens.length && tokens[pos].type === 'and') {
                pos++;
                node = new LogicNode('and', null, [node, parseAnd()]);
            }
            return node;
        };

        const parseNot = () => {
            if (pos < tokens.length && tokens[pos].type === 'not') {
                pos++;
                return new LogicNode('not', null, [parseNot()]);
            }
            return parsePrimary();
        };

        const parsePrimary = () => {
            const token = tokens[pos++];
            if (!token) throw new Error("Unexpected end of expression");
            if (token.type === 'lparen') {
                const node = parseIff();
                if (tokens[pos++]?.type !== 'rparen') throw new Error("Expected )");
                return node;
            }
            if (token.type === 'variable') {
                return new LogicNode('variable', token.value);
            }
            throw new Error(`Unexpected token: ${token.value}`);
        };

        return parseIff();
    }

    tokenize(input) {
        // Broad support for mathematical and programming logic symbols
        const regex = /\s*(=>|<=>|->|<->|~|&|\||&&|\|\||!|¬|∧|∨|→|↔|⊃|≡|NOT|AND|OR|IMPLIES|IFF|\(|\)|[a-zA-Z0-9]+)\s*/gi;
        const tokens = [];
        let match;
        while ((match = regex.exec(input)) !== null) {
            const rawVal = match[1];
            const val = rawVal.toUpperCase();
            
            if (val === '=>' || val === '→' || val === '->' || val === '⊃' || val === 'IMPLIES') 
                tokens.push({ type: 'implies', value: '=>' });
            else if (val === '<=>' || val === '↔' || val === '<->' || val === '≡' || val === 'IFF') 
                tokens.push({ type: 'iff', value: '<=>' });
            else if (val === '~' || val === '¬' || val === '!' || val === 'NOT') 
                tokens.push({ type: 'not', value: '~' });
            else if (val === '&' || val === '&&' || val === '∧' || val === 'AND') 
                tokens.push({ type: 'and', value: '&' });
            else if (val === '|' || val === '||' || val === '∨' || val === 'OR') 
                tokens.push({ type: 'or', value: '|' });
            else if (val === '(') tokens.push({ type: 'lparen', value: '(' });
            else if (val === ')') tokens.push({ type: 'rparen', value: ')' });
            else tokens.push({ type: 'variable', value: rawVal });
        }
        
        return tokens;
    }

    // --- CNF Conversion ---
    toCNF(node, logLabel = "") {
        this.cnfSteps = [];
        let current = node;

        // 1. Eliminate implications and iff
        current = this.eliminateImplications(current);
        this.logCNFStep("Eliminate Implications", current);

        // 2. Move NOTs inwards (De Morgan's)
        current = this.moveNotsInward(current);
        this.logCNFStep("Move NOTs Inward", current);

        // 3. Distribute OR over AND
        current = this.distribute(current);
        this.logCNFStep("Distribute OR over AND", current);

        return current;
    }

    logCNFStep(label, node) {
        this.cnfSteps.push({ label, result: node.toString() });
    }

    eliminateImplications(node) {
        if (node.type === 'variable') return node;
        const children = node.children.map(c => this.eliminateImplications(c));

        if (node.type === 'implies') {
            // A => B  is  ~A | B
            return new LogicNode('or', null, [
                new LogicNode('not', null, [children[0]]),
                children[1]
            ]);
        }
        if (node.type === 'iff') {
            // A <=> B is (A => B) & (B => A)
            // which is (~A | B) & (~B | A)
            return new LogicNode('and', null, [
                new LogicNode('or', null, [new LogicNode('not', null, [children[0]]), children[1]]),
                new LogicNode('or', null, [new LogicNode('not', null, [children[1]]), children[0]])
            ]);
        }
        return new LogicNode(node.type, node.value, children);
    }

    moveNotsInward(node) {
        if (node.type === 'variable') return node;

        if (node.type === 'not') {
            const child = node.children[0];
            if (child.type === 'not') { // ~~A = A
                return this.moveNotsInward(child.children[0]);
            }
            if (child.type === 'and') { // ~(A & B) = ~A | ~B
                return new LogicNode('or', null, [
                    this.moveNotsInward(new LogicNode('not', null, [child.children[0]])),
                    this.moveNotsInward(new LogicNode('not', null, [child.children[1]]))
                ]);
            }
            if (child.type === 'or') { // ~(A | B) = ~A & ~B
                return new LogicNode('and', null, [
                    this.moveNotsInward(new LogicNode('not', null, [child.children[0]])),
                    this.moveNotsInward(new LogicNode('not', null, [child.children[1]]))
                ]);
            }
            return new LogicNode('not', null, [this.moveNotsInward(child)]);
        }

        return new LogicNode(node.type, node.value, node.children.map(c => this.moveNotsInward(c)));
    }

    distribute(node) {
        if (node.type === 'variable' || node.type === 'not') return node;
        const children = node.children.map(c => this.distribute(c));

        if (node.type === 'or') {
            const [L, R] = children;
            if (L.type === 'and') { // (A & B) | C = (A | C) & (B | C)
                return this.distribute(new LogicNode('and', null, [
                    new LogicNode('or', null, [L.children[0], R]),
                    new LogicNode('or', null, [L.children[1], R])
                ]));
            }
            if (R.type === 'and') { // A | (B & C) = (A | B) & (A | C)
                return this.distribute(new LogicNode('and', null, [
                    new LogicNode('or', null, [L, R.children[0]]),
                    new LogicNode('or', null, [L, R.children[1]])
                ]));
            }
            return new LogicNode('or', null, [L, R]);
        }

        return new LogicNode(node.type, node.value, children);
    }

    // --- Clause Extraction ---
    getClauses(cnfNode) {
        const clauses = [];
        const extract = (node) => {
            if (node.type === 'and') {
                extract(node.children[0]);
                extract(node.children[1]);
            } else {
                clauses.push(this.getLiterals(node));
            }
        };
        extract(cnfNode);
        return clauses;
    }

    getLiterals(orNode) {
        const literals = new Set();
        const extract = (node) => {
            if (node.type === 'or') {
                extract(node.children[0]);
                extract(node.children[1]);
            } else {
                literals.add(node.toString());
            }
        };
        extract(orNode);
        return Array.from(literals);
    }

    // --- Resolution ---
    resolve(premises, conclusion) {
        const resolutionSteps = [];
        let clauses = [];

        // Add premises to clauses
        premises.forEach(p => {
            const node = this.parse(p);
            const cnf = this.toCNF(node);
            clauses.push(...this.getClauses(cnf));
        });

        // Negate conclusion and add to clauses
        const negConclusion = new LogicNode('not', null, [this.parse(conclusion)]);
        const negCnf = this.toCNF(negConclusion);
        clauses.push(...this.getClauses(negCnf));

        let newClauses = [...clauses];
        let steps = 0;
        const maxSteps = 100;

        while (steps < maxSteps) {
            let pairs = [];
            for (let i = 0; i < clauses.length; i++) {
                for (let j = i + 1; j < clauses.length; j++) {
                    pairs.push([clauses[i], clauses[j]]);
                }
            }

            let foundNew = false;
            for (const [c1, c2] of pairs) {
                const resolvents = this.resolvePair(c1, c2);
                for (const resolvent of resolvents) {
                    if (resolvent.length === 0) {
                        resolutionSteps.push({
                            c1: `[${c1.join(', ')}]`,
                            c2: `[${c2.join(', ')}]`,
                            res: '∅ (Contradiction)'
                        });
                        return { proved: true, resolutionSteps };
                    }
                    if (!this.containsClause(clauses, resolvent)) {
                        resolutionSteps.push({
                            c1: `[${c1.join(', ')}]`,
                            c2: `[${c2.join(', ')}]`,
                            res: `[${resolvent.join(', ')}]`
                        });
                        clauses.push(resolvent);
                        foundNew = true;
                    }
                }
            }
            if (!foundNew) break;
            steps++;
        }

        return { proved: false, resolutionSteps };
    }

    resolvePair(c1, c2) {
        const resolvents = [];
        for (const l1 of c1) {
            for (const l2 of c2) {
                if (this.isComplement(l1, l2)) {
                    const newClause = [...new Set([
                        ...c1.filter(l => l !== l1),
                        ...c2.filter(l => l !== l2)
                    ])];
                    resolvents.push(newClause);
                }
            }
        }
        return resolvents;
    }

    isComplement(l1, l2) {
        return (l1 === `~${l2}`) || (l2 === `~${l1}`);
    }

    containsClause(clauses, target) {
        const targetStr = [...target].sort().join(',');
        return clauses.some(c => [...c].sort().join(',') === targetStr);
    }

    // --- Truth Table ---
    generateTruthTable(premises, conclusion) {
        const allExprs = [...premises, conclusion].map(e => this.parse(e));
        const variables = new Set();
        allExprs.forEach(node => this.extractVariables(node, variables));
        const varList = Array.from(variables).sort();

        const rows = [];
        const numRows = Math.pow(2, varList.length);

        for (let i = numRows - 1; i >= 0; i--) {
            const values = {};
            varList.forEach((v, idx) => {
                values[v] = !!(i & (1 << (varList.length - 1 - idx)));
            });

            const row = { values: { ...values }, premises: [], conclusion: null, valid: true };
            premises.forEach(p => {
                const res = this.evaluate(this.parse(p), values);
                row.premises.push(res);
                if (!res) row.valid = false;
            });
            row.conclusion = this.evaluate(this.parse(conclusion), values);
            rows.push(row);
        }

        return { variables: varList, rows };
    }

    extractVariables(node, vars) {
        if (node.type === 'variable') vars.add(node.value);
        node.children.forEach(c => this.extractVariables(c, vars));
    }

    evaluate(node, values) {
        if (node.type === 'variable') return values[node.value];
        if (node.type === 'not') return !this.evaluate(node.children[0], values);
        if (node.type === 'and') return this.evaluate(node.children[0], values) && this.evaluate(node.children[1], values);
        if (node.type === 'or') return this.evaluate(node.children[0], values) || this.evaluate(node.children[1], values);
        if (node.type === 'implies') {
            const a = this.evaluate(node.children[0], values);
            const b = this.evaluate(node.children[1], values);
            return !a || b;
        }
        if (node.type === 'iff') {
            return this.evaluate(node.children[0], values) === this.evaluate(node.children[1], values);
        }
        return false;
    }
}

window.LogicEngine = LogicEngine;
