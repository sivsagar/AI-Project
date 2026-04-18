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

        return { variables: varList, premises, conclusion, rows };
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
        
        const logStep = (rule, result) => {
            const resStr = result.toString();
            if (steps.length === 0 || steps[steps.length - 1].result !== resStr) {
                steps.push({ rule, result: resStr });
            }
        };

        // Initial state
        logStep("Original", current);

        while (changed) {
            changed = false;
            
            // 1. Double Negation: ~~A -> A
            let next = this.applyDoubleNegation(current);
            if (next.toString() !== current.toString()) {
                current = next;
                logStep("Double Negation", current);
                changed = true;
            }

            // 2. De Morgan's: ~(A & B) -> ~A | ~B, ~(A | B) -> ~A & ~B
            next = this.applyDeMorgan(current);
            if (next.toString() !== current.toString()) {
                current = next;
                logStep("De Morgan's Law", current);
                changed = true;
            }

            // 3. Identity & Annihilation (Basic T/F rules would go here if we had T/F constants)
            // For now, let's implement basic idempotent laws: A & A -> A, A | A -> A
            next = this.applyIdempotent(current);
            if (next.toString() !== current.toString()) {
                current = next;
                logStep("Idempotent Law", current);
                changed = true;
            }

            // 4. Absorption: A | (A & B) -> A, A & (A | B) -> A
            next = this.applyAbsorption(current);
            if (next.toString() !== current.toString()) {
                current = next;
                logStep("Absorption Law", current);
                changed = true;
            }
        }

        return { result: current.toString(), steps };
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
    // Support: ∀x (P(x) → Q(x)), P(A) ⊢ Q(A)
    folInference(premises, query) {
        const facts = new Set();
        const rules = [];
        const steps = [];

        premises.forEach(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('∀') || trimmed.includes('→')) {
                rules.push(trimmed);
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
                // Simplified Regex for ∀x (P(x) → Q(x))
                const universalMatch = rule.match(/∀([a-z])\s*\((.*)\s*→\s*(.*)\)/);
                if (universalMatch) {
                    const [_, variable, antecedent, consequent] = universalMatch;
                    
                    // Look for facts that match the antecedent via Universal Instantiation
                    for (const fact of facts) {
                        const predMatch = antecedent.match(/([A-Z][a-z]*)\(([a-z])\)/);
                        const factMatch = fact.match(/([A-Z][a-z]*)\(([A-Z][a-z]*)\)/);
                        
                        if (predMatch && factMatch && predMatch[1] === factMatch[1] && predMatch[2] === variable) {
                            const constant = factMatch[2];
                            // Substitute variable with constant in consequent
                            const derived = consequent.replace(new RegExp(`\\b${variable}\\b`, 'g'), constant);
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
                
                // Modus Ponens: P → Q, P ⊢ Q
                const mpMatch = rule.match(/(.*)\s*→\s*(.*)/);
                if (mpMatch && !rule.startsWith('∀')) {
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

        const proved = facts.has(query.trim());
        return { proved, steps, facts: Array.from(facts) };
    }
}

window.LogicEngine = LogicEngine;

