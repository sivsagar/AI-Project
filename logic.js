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

    equals(other) {
        if (!other || this.type !== other.type || this.value !== other.value) return false;
        if (this.children.length !== other.children.length) return false;
        
        // For commutative operators, we should ideally check both orders,
        // but for now, we'll assume a normalized structure or check both.
        if (this.type === 'and' || this.type === 'or' || this.type === 'iff') {
            return (this.children[0].equals(other.children[0]) && this.children[1].equals(other.children[1])) ||
                   (this.children[0].equals(other.children[1]) && this.children[1].equals(other.children[0]));
        }
        
        for (let i = 0; i < this.children.length; i++) {
            if (!this.children[i].equals(other.children[i])) return false;
        }
        return true;
    }
}

class TableauxNode {
    constructor(formulas = [], parent = null) {
        this.formulas = formulas; // Array of {node: LogicNode, origin: string}
        this.parent = parent;
        this.children = [];
        this.closed = false;
        this.closedBy = null; // [l1, l2]
        this.literals = new Set();
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
            if (pos < tokens.length && tokens[pos].type === 'iff') {
                pos++;
                node = new LogicNode('iff', null, [node, parseIff()]);
            }
            return node;
        };

        const parseImplies = () => {
            let node = parseOr();
            if (pos < tokens.length && tokens[pos].type === 'implies') {
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

        const result = parseIff();
        if (pos < tokens.length) {
            throw new Error(`Unexpected token or incomplete expression near: '${tokens[pos].value}'`);
        }
        return result;
    }

    tokenize(input) {
        // Broad support for mathematical and programming logic symbols
        const regex = /\s*(=>|<=>|->|<->|==|=|~|&|\||&&|\|\||!|¬|∧|∨|→|↔|⊃|≡|NOT|AND|OR|IMPLIES|IFF|\(|\)|[a-zA-Z0-9]+)\s*/gi;
        const tokens = [];
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(input)) !== null) {
            // Check for invalid skipped characters
            if (match.index > lastIndex) {
                const skipped = input.substring(lastIndex, match.index).trim();
                if (skipped) throw new Error(`Invalid or unrecognized character: '${skipped}'`);
            }
            lastIndex = regex.lastIndex;

            const rawVal = match[1];
            const val = rawVal.toUpperCase();
            
            if (val === '=>' || val === '→' || val === '->' || val === '⊃' || val === 'IMPLIES') 
                tokens.push({ type: 'implies', value: '=>' });
            else if (val === '<=>' || val === '↔' || val === '<->' || val === '≡' || val === 'IFF' || val === '=' || val === '==') 
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
        const maxSteps = 500;

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

    isComplement(n1, n2) {
        if (typeof n1 === 'string' && typeof n2 === 'string') {
            return (n1 === `~${n2}`) || (n2 === `~${n1}`);
        }
        if (n1.type === 'not') return n1.children[0].equals(n2);
        if (n2.type === 'not') return n2.children[0].equals(n1);
        return false;
    }

    containsClause(clauses, target) {
        const targetStr = [...target].sort().join(',');
        return clauses.some(c => [...c].sort().join(',') === targetStr);
    }

    // --- Truth Table ---
    generateTruthTable(premises, conclusion) {
        const conclusionNode = this.parse(conclusion);
        const subExprNodes = [];
        this.extractSubExpressions(conclusionNode, subExprNodes);
        
        // Remove variables from subExprNodes to avoid duplication with the variable list
        // and filter to only unique strings
        const subExprMap = new Map();
        subExprNodes.forEach(node => {
            const s = node.toString();
            if (node.type !== 'variable' && !subExprMap.has(s)) {
                subExprMap.set(s, node);
            }
        });
        const uniqueSubExprs = Array.from(subExprMap.values());

        const variables = new Set();
        this.extractVariables(conclusionNode, variables);
        premises.forEach(p => this.extractVariables(this.parse(p), variables));
        const varList = Array.from(variables).sort();

        const rows = [];
        const numRows = Math.pow(2, varList.length);
        if (numRows > 16384) throw new Error(`Too many variables (${varList.length}). Maximum 14 variables allowed for truth tables.`);

        for (let i = numRows - 1; i >= 0; i--) {
            const values = {};
            varList.forEach((v, idx) => {
                values[v] = !!(i & (1 << (varList.length - 1 - idx)));
            });

            const row = { 
                values: { ...values }, 
                subExpressions: [], 
                conclusion: null 
            };
            
            uniqueSubExprs.forEach(node => {
                row.subExpressions.push({
                    label: node.toString(),
                    value: this.evaluate(node, values)
                });
            });

            row.conclusion = this.evaluate(conclusionNode, values);
            rows.push(row);
        }

        return { 
            variables: varList, 
            subExpressions: uniqueSubExprs.map(n => n.toString()),
            conclusion, 
            rows 
        };
    }

    extractSubExpressions(node, exprs) {
        node.children.forEach(c => this.extractSubExpressions(c, exprs));
        exprs.push(node);
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

    // --- Semantic Tableaux ---
    generateTableaux(premises, conclusion) {
        const rootFormulas = [
            ...premises.map(p => ({ node: this.parse(p), origin: 'Premise' })),
            { node: new LogicNode('not', null, [this.parse(conclusion)]), origin: 'Negated Conclusion' }
        ];

        const root = new TableauxNode(rootFormulas);
        this.expandTableaux(root, new Set());
        return root;
    }

    expandTableaux(node, branchLiterals) {
        // 1. Check for contradictions in current branch
        const currentLiterals = new Set(branchLiterals);
        for (const f of node.formulas) {
            const s = f.node.toString();
            if (f.node.type === 'variable' || (f.node.type === 'not' && f.node.children[0].type === 'variable')) {
                // Check contradiction
                const comp = f.node.type === 'variable' ? `~${s}` : s.substring(1);
                if (currentLiterals.has(comp)) {
                    node.closed = true;
                    node.closedBy = [s, comp];
                    return;
                }
                currentLiterals.add(s);
            }
        }
        node.literals = currentLiterals;

        // 2. Find a formula to decompose
        let targetIdx = -1;
        let ruleType = null; // 'alpha' or 'beta'

        for (let i = 0; i < node.formulas.length; i++) {
            const f = node.formulas[i];
            const type = this.getTableauxRule(f.node);
            if (type) {
                targetIdx = i;
                ruleType = type;
                break;
            }
        }

        if (targetIdx === -1) {
            // No more formulas to decompose
            node.closed = false;
            return;
        }

        const target = node.formulas[targetIdx];
        const remaining = node.formulas.filter((_, idx) => idx !== targetIdx);
        const results = this.applyTableauxRule(target.node);

        if (ruleType === 'alpha') {
            // Alpha rule: single branch
            const newNode = new TableauxNode([...remaining, ...results], node);
            node.children = [newNode];
            this.expandTableaux(newNode, currentLiterals);
            if (newNode.closed) node.closed = true;
        } else {
            // Beta rule: branching
            node.children = results.map(res => new TableauxNode([...remaining, res], node));
            let allClosed = true;
            for (const child of node.children) {
                this.expandTableaux(child, currentLiterals);
                if (!child.closed) allClosed = false;
            }
            if (node.children.length > 0 && allClosed) node.closed = true;
        }
    }

    getTableauxRule(node) {
        if (node.type === 'variable') return null;
        if (node.type === 'not') {
            const child = node.children[0];
            if (child.type === 'variable') return null;
            if (child.type === 'not') return 'alpha'; // ~~A
            if (child.type === 'or') return 'alpha';  // ~(A|B) -> ~A, ~B
            if (child.type === 'implies') return 'alpha'; // ~(A=>B) -> A, ~B
            if (child.type === 'and') return 'beta';  // ~(A&B) -> ~A | ~B
            if (child.type === 'iff') return 'beta';  // ~(A<=>B) -> (A&~B) | (~A&B)
            return 'alpha';
        }
        if (node.type === 'and') return 'alpha';
        if (node.type === 'or') return 'beta';
        if (node.type === 'implies') return 'beta';
        if (node.type === 'iff') return 'beta';
        return null;
    }

    applyTableauxRule(node) {
        if (node.type === 'not') {
            const child = node.children[0];
            if (child.type === 'not') return [{ node: child.children[0], origin: 'Double Negation' }];
            if (child.type === 'and') { // ~(A & B) -> ~A | ~B
                return [
                    { node: new LogicNode('not', null, [child.children[0]]), origin: 'De Morgan' },
                    { node: new LogicNode('not', null, [child.children[1]]), origin: 'De Morgan' }
                ];
            }
            if (child.type === 'or') { // ~(A | B) -> ~A, ~B
                return [
                    { node: new LogicNode('not', null, [child.children[0]]), origin: 'De Morgan' },
                    { node: new LogicNode('not', null, [child.children[1]]), origin: 'De Morgan' }
                ];
            }
            if (child.type === 'implies') { // ~(A => B) -> A, ~B
                return [
                    { node: child.children[0], origin: 'Negated Implication' },
                    { node: new LogicNode('not', null, [child.children[1]]), origin: 'Negated Implication' }
                ];
            }
            if (child.type === 'iff') { // ~(A <=> B) -> (A & ~B) | (~A & B)
                return [
                    { node: new LogicNode('and', null, [child.children[0], new LogicNode('not', null, [child.children[1]])]), origin: 'Negated IFF' },
                    { node: new LogicNode('and', null, [new LogicNode('not', null, [child.children[0]]), child.children[1]]), origin: 'Negated IFF' }
                ];
            }
        }
        if (node.type === 'and') {
            return [
                { node: node.children[0], origin: 'Conjunction' },
                { node: node.children[1], origin: 'Conjunction' }
            ];
        }
        if (node.type === 'or') {
            return [
                { node: node.children[0], origin: 'Disjunction' },
                { node: node.children[1], origin: 'Disjunction' }
            ];
        }
        if (node.type === 'implies') {
            return [
                { node: new LogicNode('not', null, [node.children[0]]), origin: 'Implication' },
                { node: node.children[1], origin: 'Implication' }
            ];
        }
        if (node.type === 'iff') {
            return [
                { node: new LogicNode('and', null, [node.children[0], node.children[1]]), origin: 'Equivalence' },
                { node: new LogicNode('and', null, [new LogicNode('not', null, [node.children[0]]), new LogicNode('not', null, [node.children[1]])]), origin: 'Equivalence' }
            ];
        }
        return [];
    }

    // --- Simplification ---
    simplify(node) {
        let current = node;
        let changed = true;
        let steps = [];
        
        const logStep = (rule, description, result) => {
            const resStr = result.toString();
            if (steps.length === 0 || steps[steps.length - 1].result !== resStr) {
                steps.push({ rule, description, result: resStr });
            }
        };

        // Initial state
        logStep("Original", "The starting logical expression.", current);

        while (changed) {
            changed = false;
            
            // 1. Double Negation: ~~A -> A
            let next = this.applyDoubleNegation(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Double Negation", "Removed double negations (¬¬A ≡ A).", current);
                changed = true;
                continue; // Restart rules on new expression
            }

            // 2. De Morgan's: ~(A & B) -> ~A | ~B, ~(A | B) -> ~A & ~B
            next = this.applyDeMorgan(current);
            if (!next.equals(current)) {
                current = next;
                logStep("De Morgan's Law", "Distributed negation across AND/OR operators.", current);
                changed = true;
                continue;
            }

            // 3. Idempotent laws: A & A -> A, A | A -> A
            next = this.applyIdempotent(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Idempotent Law", "Simplified redundant repeated terms (A ∧ A ≡ A).", current);
                changed = true;
                continue;
            }

            // 4. Absorption Phase 1 (Factoring)
            next = this.applyAbsorption(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Factoring (Distributive)", "Factored out common terms (e.g., A ∨ (A ∧ B) → A ∧ (T ∨ B)).", current);
                changed = true;
                continue;
            }

            // 5. Redundancy Phase 1 (Expansion)
            next = this.applyRedundancy(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Distributive Law", "Distributed terms to reveal complements (e.g., A ∨ (¬A ∧ B) → (A ∨ ¬A) ∧ (A ∨ B)).", current);
                changed = true;
                continue;
            }

            // 6. Complement Law: A | ~A -> T, A & ~A -> F
            next = this.applyComplement(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Complement Law", "Simplified using complements (A ∨ ¬A ≡ T, A ∧ ¬A ≡ F).", current);
                changed = true;
                continue;
            }

            // 7. Identity & Annihilation: A & T -> A, A | F -> A, etc.
            next = this.applyIdentity(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Identity Law", "Simplified using logical constants (T/F).", current);
                changed = true;
                continue;
            }

            // 8. Distributive Law (Specific Patterns)
            next = this.applyDistributive(current);
            if (!next.equals(current)) {
                current = next;
                logStep("Distributive Law", "Factored or distributed terms to enable further simplification.", current);
                changed = true;
                continue;
            }
        }

        return { result: current.toString(), steps };
    }

    applyIdentity(node) {
        if (node.type === 'and') {
            const [L, R] = node.children;
            const lVal = this.applyIdentity(L);
            const rVal = this.applyIdentity(R);
            if (lVal.value === 'T' || lVal.value === 'TRUE') return rVal;
            if (rVal.value === 'T' || rVal.value === 'TRUE') return lVal;
            if (lVal.value === 'F' || lVal.value === 'FALSE') return new LogicNode('variable', 'F');
            if (rVal.value === 'F' || rVal.value === 'FALSE') return new LogicNode('variable', 'F');
            return new LogicNode('and', null, [lVal, rVal]);
        }
        if (node.type === 'or') {
            const [L, R] = node.children;
            const lVal = this.applyIdentity(L);
            const rVal = this.applyIdentity(R);
            if (lVal.value === 'F' || lVal.value === 'FALSE') return rVal;
            if (rVal.value === 'F' || rVal.value === 'FALSE') return lVal;
            if (lVal.value === 'T' || lVal.value === 'TRUE') return new LogicNode('variable', 'T');
            if (rVal.value === 'T' || rVal.value === 'TRUE') return new LogicNode('variable', 'T');
            return new LogicNode('or', null, [lVal, rVal]);
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyIdentity(c)));
    }

    applyComplement(node) {
        if (node.type === 'or') {
            const [L, R] = node.children;
            if (this.isComplement(L, R)) return new LogicNode('variable', 'T');
        }
        if (node.type === 'and') {
            const [L, R] = node.children;
            if (this.isComplement(L, R)) return new LogicNode('variable', 'F');
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyComplement(c)));
    }

    applyAbsorption(node) {
        if (node.type === 'or') {
            const [L, R] = node.children;
            if (R.type === 'and') {
                if (R.children[0].equals(L)) return new LogicNode('and', null, [L, new LogicNode('or', null, [new LogicNode('variable', 'T'), R.children[1]])]);
                if (R.children[1].equals(L)) return new LogicNode('and', null, [L, new LogicNode('or', null, [new LogicNode('variable', 'T'), R.children[0]])]);
            }
            if (L.type === 'and') {
                if (L.children[0].equals(R)) return new LogicNode('and', null, [R, new LogicNode('or', null, [new LogicNode('variable', 'T'), L.children[1]])]);
                if (L.children[1].equals(R)) return new LogicNode('and', null, [R, new LogicNode('or', null, [new LogicNode('variable', 'T'), L.children[0]])]);
            }
        }
        if (node.type === 'and') {
            const [L, R] = node.children;
            if (R.type === 'or') {
                if (R.children[0].equals(L)) return new LogicNode('or', null, [L, new LogicNode('and', null, [new LogicNode('variable', 'F'), R.children[1]])]);
                if (R.children[1].equals(L)) return new LogicNode('or', null, [L, new LogicNode('and', null, [new LogicNode('variable', 'F'), R.children[0]])]);
            }
            if (L.type === 'or') {
                if (L.children[0].equals(R)) return new LogicNode('or', null, [R, new LogicNode('and', null, [new LogicNode('variable', 'F'), L.children[1]])]);
                if (L.children[1].equals(R)) return new LogicNode('or', null, [R, new LogicNode('and', null, [new LogicNode('variable', 'F'), L.children[0]])]);
            }
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyAbsorption(c)));
    }

    applyRedundancy(node) {
        if (node.type === 'or') {
            const [L, R] = node.children;
            // A | (~A & B) -> (A | ~A) & (A | B)
            if (R.type === 'and') {
                if (this.isComplement(L, R.children[0])) return new LogicNode('and', null, [new LogicNode('or', null, [L, R.children[0]]), new LogicNode('or', null, [L, R.children[1]])]);
                if (this.isComplement(L, R.children[1])) return new LogicNode('and', null, [new LogicNode('or', null, [L, R.children[1]]), new LogicNode('or', null, [L, R.children[0]])]);
            }
            if (L.type === 'and') {
                if (this.isComplement(R, L.children[0])) return new LogicNode('and', null, [new LogicNode('or', null, [R, L.children[0]]), new LogicNode('or', null, [R, L.children[1]])]);
                if (this.isComplement(R, L.children[1])) return new LogicNode('and', null, [new LogicNode('or', null, [R, L.children[1]]), new LogicNode('or', null, [R, L.children[0]])]);
            }
        }
        if (node.type === 'and') {
            const [L, R] = node.children;
            // A & (~A | B) -> (A & ~A) | (A & B)
            if (R.type === 'or') {
                if (this.isComplement(L, R.children[0])) return new LogicNode('or', null, [new LogicNode('and', null, [L, R.children[0]]), new LogicNode('and', null, [L, R.children[1]])]);
                if (this.isComplement(L, R.children[1])) return new LogicNode('or', null, [new LogicNode('and', null, [L, R.children[1]]), new LogicNode('and', null, [L, R.children[0]])]);
            }
            if (L.type === 'or') {
                if (this.isComplement(R, L.children[0])) return new LogicNode('or', null, [new LogicNode('and', null, [R, L.children[0]]), new LogicNode('and', null, [R, L.children[1]])]);
                if (this.isComplement(R, L.children[1])) return new LogicNode('or', null, [new LogicNode('and', null, [R, L.children[1]]), new LogicNode('and', null, [R, L.children[0]])]);
            }
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyRedundancy(c)));
    }

    applyDistributive(node) {
        if (node.type === 'or') {
            const [L, R] = node.children;
            // (A & B) | (A & C) -> A & (B | C)
            if (L.type === 'and' && R.type === 'and') {
                if (L.children[0].equals(R.children[0])) return new LogicNode('and', null, [L.children[0], new LogicNode('or', null, [L.children[1], R.children[1]])]);
                if (L.children[0].equals(R.children[1])) return new LogicNode('and', null, [L.children[0], new LogicNode('or', null, [L.children[1], R.children[0]])]);
                if (L.children[1].equals(R.children[0])) return new LogicNode('and', null, [L.children[1], new LogicNode('or', null, [L.children[0], R.children[1]])]);
                if (L.children[1].equals(R.children[1])) return new LogicNode('and', null, [L.children[1], new LogicNode('or', null, [L.children[0], R.children[0]])]);
            }
        }
        if (node.type === 'and') {
            const [L, R] = node.children;
            // (A | B) & (A | C) -> A | (B & C)
            if (L.type === 'or' && R.type === 'or') {
                if (L.children[0].equals(R.children[0])) return new LogicNode('or', null, [L.children[0], new LogicNode('and', null, [L.children[1], R.children[1]])]);
                if (L.children[0].equals(R.children[1])) return new LogicNode('or', null, [L.children[0], new LogicNode('and', null, [L.children[1], R.children[0]])]);
                if (L.children[1].equals(R.children[0])) return new LogicNode('or', null, [L.children[1], new LogicNode('and', null, [L.children[0], R.children[1]])]);
                if (L.children[1].equals(R.children[1])) return new LogicNode('or', null, [L.children[1], new LogicNode('and', null, [L.children[0], R.children[0]])]);
            }
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyDistributive(c)));
    }

    applyDoubleNegation(node) {
        if (node.type === 'not' && node.children[0].type === 'not') {
            return this.applyDoubleNegation(node.children[0].children[0]);
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyDoubleNegation(c)));
    }

    applyDeMorgan(node) {
        if (node.type === 'not') {
            const child = node.children[0];
            if (child.type === 'and') {
                return new LogicNode('or', null, [
                    new LogicNode('not', null, [child.children[0]]),
                    new LogicNode('not', null, [child.children[1]])
                ]);
            }
            if (child.type === 'or') {
                return new LogicNode('and', null, [
                    new LogicNode('not', null, [child.children[0]]),
                    new LogicNode('not', null, [child.children[1]])
                ]);
            }
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyDeMorgan(c)));
    }

    applyIdempotent(node) {
        if ((node.type === 'and' || node.type === 'or') && node.children[0].toString() === node.children[1].toString()) {
            return this.applyIdempotent(node.children[0]);
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyIdempotent(c)));
    }

    applyAbsorption(node) {
        if (node.type === 'or') {
            const [L, R] = node.children;
            if (R.type === 'and' && (R.children[0].toString() === L.toString() || R.children[1].toString() === L.toString())) return L;
            if (L.type === 'and' && (L.children[0].toString() === R.toString() || L.children[1].toString() === R.toString())) return R;
        }
        if (node.type === 'and') {
            const [L, R] = node.children;
            if (R.type === 'or' && (R.children[0].toString() === L.toString() || R.children[1].toString() === L.toString())) return L;
            if (L.type === 'or' && (L.children[0].toString() === R.toString() || L.children[1].toString() === R.toString())) return R;
        }
        return new LogicNode(node.type, node.value, node.children.map(c => this.applyAbsorption(c)));
    }

    // --- FOL Inference Engine (Simplified) ---
    folInference(premises, query) {
        const facts = new Set();
        const rules = [];
        const steps = [];
        let skolemCounter = 1;

        premises.forEach(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('∀') || trimmed.includes('→') || trimmed.includes('=>') || trimmed.includes('->')) {
                rules.push(trimmed);
            } else if (trimmed.startsWith('∃')) {
                // Existential Instantiation
                const match = trimmed.match(/∃([a-z])\s*(.*)$/);
                if (match) {
                    const [_, variable, body] = match;
                    const skolemConst = `C${skolemCounter++}`;
                    const instantiated = body.replace(new RegExp(`\\b${variable}\\b`, 'g'), skolemConst).trim();
                    facts.add(instantiated);
                    steps.push({
                        rule: "Existential Instantiation",
                        from: trimmed,
                        result: instantiated
                    });
                }
            } else {
                facts.add(trimmed);
            }
        });

        let changed = true;
        const maxIter = 10;
        let iter = 0;

        while (changed && iter < maxIter) {
            changed = false;
            iter++;

            for (const rule of rules) {
                const universalMatch = rule.match(/∀([a-z])\s*(.*)$/);
                if (universalMatch) {
                    const [_, variable, body] = universalMatch;
                    let cleanBody = body.trim();
                    if (cleanBody.startsWith('(') && cleanBody.endsWith(')')) {
                        cleanBody = cleanBody.substring(1, cleanBody.length - 1).trim();
                    }

                    const arrowMatch = cleanBody.match(/^(.*?)\s*[→→>]\s*(.*?)$/);
                    if (arrowMatch) {
                        const antecedent = arrowMatch[1].trim();
                        const consequent = arrowMatch[2].trim();
                        
                        const stripOuter = (s) => {
                            let res = s;
                            if (res.startsWith('(') && res.endsWith(')')) {
                                res = res.substring(1, res.length - 1).trim();
                            }
                            return res;
                        };
                        const antClean = stripOuter(antecedent);
                        const consClean = stripOuter(consequent);
                        
                        for (const fact of facts) {
                            const factMatch = fact.match(/^([A-Z][a-zA-Z0-9]*)\((.*)\)$/);
                            if (!factMatch) continue;
                            
                            const factPred = factMatch[1];
                            const factArgs = factMatch[2].split(',').map(s => s.trim());

                            const antMatch = antClean.match(/^([A-Z][a-zA-Z0-9]*)\((.*)\)$/);
                            if (antMatch) {
                                const antPred = antMatch[1];
                                const antArgs = antMatch[2].split(',').map(s => s.trim());

                                if (antPred === factPred && antArgs.length === factArgs.length) {
                                    let canUnify = true;
                                    const substitution = {};
                                    for (let i = 0; i < antArgs.length; i++) {
                                        if (antArgs[i] === variable) {
                                            substitution[variable] = factArgs[i];
                                        } else if (antArgs[i] !== factArgs[i]) {
                                            canUnify = false;
                                            break;
                                        }
                                    }

                                    if (canUnify) {
                                        let derived = consClean;
                                        for (const [v, c] of Object.entries(substitution)) {
                                            derived = derived.replace(new RegExp(`\\b${v}\\b`, 'g'), c);
                                        }
                                        if (!facts.has(derived)) {
                                            facts.add(derived);
                                            steps.push({
                                                rule: "Universal Instantiation + Modus Ponens",
                                                from: `${rule} and ${fact}`,
                                                result: derived
                                            });
                                            changed = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Standard Modus Ponens for non-quantified rules
                    const mpMatch = rule.match(/^(.*?)\s*[→→>]\s*(.*?)$/);
                    if (mpMatch) {
                        const [_, ant, cons] = mpMatch;
                        const antClean = ant.trim().replace(/^\(|\)$/g, '');
                        const consClean = cons.trim().replace(/^\(|\)$/g, '');
                        
                        if (facts.has(antClean) && !facts.has(consClean)) {
                            facts.add(consClean);
                            steps.push({
                                rule: "Modus Ponens",
                                from: `${rule} and ${antClean}`,
                                result: consClean
                            });
                            changed = true;
                        }
                    }
                }
            }
        }

        let proved = facts.has(query.trim());
        
        // Existential Generalization for Query
        if (!proved && query.trim().startsWith('∃')) {
            const match = query.trim().match(/∃([a-z])\s*(.*)$/);
            if (match) {
                const [_, variable, body] = match;
                const bodyMatch = body.trim().match(/^([A-Z][a-zA-Z0-9]*)\((.*)\)$/);
                if (bodyMatch) {
                    const queryPred = bodyMatch[1];
                    const queryArgs = bodyMatch[2].split(',').map(s => s.trim());
                    
                    for (const fact of facts) {
                        const factMatch = fact.match(/^([A-Z][a-zA-Z0-9]*)\((.*)\)$/);
                        if (factMatch && factMatch[1] === queryPred) {
                            const factArgs = factMatch[2].split(',').map(s => s.trim());
                            if (factArgs.length === queryArgs.length) {
                                let canGeneralize = true;
                                for (let i = 0; i < queryArgs.length; i++) {
                                    if (queryArgs[i] !== variable && queryArgs[i] !== factArgs[i]) {
                                        canGeneralize = false;
                                        break;
                                    }
                                }
                                if (canGeneralize) {
                                    proved = true;
                                    steps.push({
                                        rule: "Existential Generalization",
                                        from: fact,
                                        result: query.trim()
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return { proved, steps, facts: Array.from(facts) };
    }

    checkEquivalence(expr1, expr2) {
        const node1 = this.parse(expr1);
        const node2 = this.parse(expr2);
        
        const variables = new Set();
        this.extractVariables(node1, variables);
        this.extractVariables(node2, variables);
        const varList = Array.from(variables).sort();
        
        if (varList.length > 14) throw new Error(`Too many variables (${varList.length}). Maximum 14 variables allowed.`);
        
        const numRows = Math.pow(2, varList.length);
        for (let i = 0; i < numRows; i++) {
            const values = {};
            varList.forEach((v, idx) => {
                values[v] = !!(i & (1 << (varList.length - 1 - idx)));
            });
            
            if (this.evaluate(node1, values) !== this.evaluate(node2, values)) {
                return false;
            }
        }
        return true;
    }
}

window.LogicEngine = LogicEngine;
