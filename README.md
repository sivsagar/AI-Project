# AI Logic Theorem Solver

A professional, high-performance symbolic AI web application for formal logic reasoning. This tool allows users to parse, simplify, and prove theorems using state-of-the-art logical algorithms.

---

## 📊 Context Report
**Project Status:** Fully Functional & Production-Ready
**Core Capabilities:**
This application serves as an educational and mathematical engine capable of processing propositional and first-order logic (FOL) without relying on external mathematical libraries. 
Recent structural upgrades include:
1. **Deep Equality Engine**: Replaced string-based matching with AST (Abstract Syntax Tree) deep-node equality to correctly handle commutative properties ($A \wedge B \equiv B \wedge A$).
2. **Rigorous Simplification**: Eliminated "macro leaps" in logical reduction. The simplifier now strictly uses fundamental laws (Distributive Expansion/Factoring) to provide mathematically sound, step-by-step proofs for rules like Absorption and Redundancy.
3. **Existential FOL Enhancements**: The inference engine now supports Existential Instantiation (Skolemization) and Existential Generalization, fully bridging the gap between Universal ($\forall$) and Existential ($\exists$) logical statements.
4. **Comparative Equivalence**: The Equivalence Checker now generates and compares massive truth tables row-by-row to provide explicit visual proof of equivalency.

---

## 🚀 Working Procedure
The application operates through a strict pipeline to transform human-readable logic into mathematical derivations:

1. **Lexical Tokenization**: Raw user input strings are scanned using Regex. Special characters, words, and symbols (e.g., `¬`, `AND`, `=>`, `≡`, `∃`) are mapped to internal tokens.
2. **AST Parsing (Recursive Descent)**: The tokens are fed into a Recursive Descent Parser that strictly enforces operator precedence (NOT > AND > OR > IMPLIES > IFF). This outputs a hierarchical Abstract Syntax Tree (AST).
3. **Mathematical Evaluation / Transformation**: 
   - *For Truth Tables*: The AST is evaluated against all possible boolean permutations.
   - *For Provers*: The AST undergoes transformations (like De Morgan's or Implication Elimination) to reach Conjunctive Normal Form (CNF).
4. **Algorithmic Execution**: The respective AI engine (Resolution, Tableaux, or FOL Chainer) traverses the transformed AST to derive new data or locate contradictions.
5. **DOM Rendering**: Results are mapped to UI components (cards, dynamic HTML tables, or visual DOM trees) with color-coded success/error states.

---

## 🧠 Algorithms 

### 1. Expression Simplifier
Uses a rule-based fixed-point iteration algorithm. The engine applies fundamental laws to the AST until the tree reaches a stable state (no further transformations are possible).
- **Laws Applied**: Double Negation, De Morgan's, Idempotent, Factoring (Distributive Phase 1), Expansion (Distributive Phase 2), Complement, and Identity/Annihilation.

### 2. Resolution Refutation
A proof-by-contradiction algorithm for propositional logic.
1. Negate the conclusion.
2. Convert all premises and the negated conclusion into CNF.
3. Extract clauses (sets of literals).
4. Iteratively search for complementary literals ($P$ and $\neg P$).
5. Resolve pairs by merging them and dropping the complement.
6. If the empty clause ($\emptyset$) is derived, the theorem is proven valid.

### 3. First-Order Logic (Forward Chaining)
Handles quantified variables and predicate logic.
1. **Skolemization**: Any premise starting with $\exists x$ is instantiated into a grounded constant ($C_1$).
2. **Universal Instantiation**: Rules like $\forall x$ are matched against grounded facts. The variable $x$ is unified with the constant.
3. **Modus Ponens**: If the antecedent unifies, the consequent is added to the Knowledge Base as a new fact.
4. **Existential Generalization**: If the query is an existential ($\exists x \ P(x)$), the engine scans the facts to see if $P(C)$ exists for any constant $C$.

---

## 💻 Pseudo Code

### 1. Simplification Engine (Fixed-Point Loop)
```text
FUNCTION Simplify(AST_Node):
    Set Changed = True
    While Changed == True:
        Changed = False
        
        // Try all fundamental transformations
        NextNode = ApplyDoubleNegation(AST_Node)
        If NextNode != AST_Node:
            AST_Node = NextNode
            Changed = True
            Continue
            
        NextNode = ApplyDeMorgan(AST_Node)
        If NextNode != AST_Node:
            AST_Node = NextNode
            Changed = True
            Continue
            
        // ... (Apply Idempotent, Factoring, Expansion) ...
        
        NextNode = ApplyComplement(AST_Node)  // A | ~A -> T
        If NextNode != AST_Node:
            AST_Node = NextNode
            Changed = True
            Continue
            
    Return AST_Node
```

### 2. Resolution Algorithm
```text
FUNCTION Resolve(Premises, Conclusion):
    Set Clauses = []
    
    For Each Premise in Premises:
        Clauses.Append(ConvertToCNF(Premise))
        
    NegatedConclusion = Negate(Conclusion)
    Clauses.Append(ConvertToCNF(NegatedConclusion))
    
    While NewClausesCanBeGenerated:
        For i from 0 to Length(Clauses):
            For j from i+1 to Length(Clauses):
                If IsComplement(Clauses[i], Clauses[j]):
                    Resolvent = Merge(Clauses[i], Clauses[j]) - Complement
                    If Resolvent is Empty:
                        Return TRUE (Contradiction Found)
                    If Resolvent NOT in Clauses:
                        Clauses.Append(Resolvent)
                        
    Return FALSE (Cannot be proved)
```

### 3. FOL Inference (Existential & Universal)
```text
FUNCTION FOL_Inference(Premises, Query):
    Facts = Set()
    Rules = List()
    
    // Pre-processing
    For Each Premise in Premises:
        If Premise starts with '∃':
            Extract Variable and Body
            NewConstant = GenerateSkolemConstant()
            Facts.Add(Substitute(Body, Variable, NewConstant))
        Else If Premise starts with '∀':
            Rules.Append(Premise)
        Else:
            Facts.Add(Premise)
            
    // Forward Chaining
    While Facts are changing:
        For Each Rule in Rules:
            For Each Fact in Facts:
                If Rule.Antecedent unifies with Fact:
                    DerivedFact = ApplySubstitution(Rule.Consequent)
                    Facts.Add(DerivedFact)
                    
    // Query Check
    If Query starts with '∃':
        Extract Variable and Predicate
        For Each Fact in Facts:
            If Fact matches Predicate schema:
                Return TRUE // Existential Generalization
                
    Return Facts.Contains(Query)
```