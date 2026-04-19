# AI Logic Theorem Solver

A professional, high-performance symbolic AI web application for formal logic reasoning. This tool allows users to parse, simplify, and prove theorems using state-of-the-art logical algorithms.

## ✨ Features
- **Truth Table Generator**: Exhaustive evaluation of propositional formulas.
- **Expression Simplifier**: Reduction of logic trees using algebraic identities.
- **Equivalence Checker**: Verification of logical parity between two expressions.
- **Theorem Prover**: Automated proofs using Resolution Refutation and Semantic Tableaux.
- **FOL Inference Engine**: Forward chaining for First-Order Logic with universal quantification.

---

## 🚀 Working Procedure

The application operates through a structured pipeline to transform human-readable logic into derived conclusions:

1.  **Lexical Tokenization**: Raw strings are scanned using Regex to identify logical operators (`¬`, `∧`, `∨`, `→`, `↔`) and variables.
2.  **AST Parsing**: A **Recursive Descent Parser** constructs an Abstract Syntax Tree (AST), enforcing operator precedence and handling nested parentheses.
3.  **Logical Transformation**: Depending on the goal, the AST is transformed (e.g., converted to **Conjunctive Normal Form** for resolution).
4.  **Algorithmic Processing**: The core engines (Resolution, Tableaux, or Inference) process the AST to find contradictions or valid derivations.
5.  **Visual Output**: Results are rendered as interactive step-by-step cards, truth tables, or dynamic trees.

---

## 🧠 Core Algorithms

### 1. Resolution Refutation
The primary proof method for propositional logic.
- **Negation of Goal**: To prove $P \vdash C$, the engine attempts to find a contradiction in $P \wedge \neg C$.
- **CNF Conversion**: Formulas are standardized by eliminating implications and distributing OR over AND.
- **Literal Resolution**: Clauses are iteratively resolved until an empty clause ($\emptyset$) is found.

### 2. Semantic Tableaux (Truth Trees)
A tree-based method that decomposes formulas into literals.
- **Alpha Rules**: Decomposes non-branching formulas (e.g., $A \wedge B$).
- **Beta Rules**: Creates branches for disjunctions (e.g., $A \vee B$).
- **Closure**: A branch is "closed" if it contains a contradiction ($L$ and $\neg L$). If all branches close, the theorem is proved.

### 3. FOL Forward Chaining
Handles First-Order Logic predicates.
- **Universal Instantiation**: Substitutes universal variables with specific constants from the knowledge base.
- **Modus Ponens**: Derives new facts by matching rules against existing data.

### 4. Simplification Laws
Iteratively applies:
- **Double Negation**: $\neg \neg A \to A$
- **De Morgan’s Laws**: $\neg(A \wedge B) \to \neg A \vee \neg B$
- **Idempotent & Absorption Laws**: Reducing redundant terms.

---

## 🛠️ Technology Stack
- **Logic Engine**: Pure ES6+ JavaScript.
- **Styling**: Vanilla CSS3 with HSL-based design tokens and glassmorphism.
- **UI**: Modern, responsive DOM manipulation.