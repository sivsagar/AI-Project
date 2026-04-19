/**
 * AI Logic Theorem Solver — UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new window.LogicEngine();

    // === Global State ===
    let lastFocusedInput = document.getElementById('tt-expr');

    // === Global Elements ===
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    // === Module & Tab Switching ===
    const moduleBtns = document.querySelectorAll('.module-btn');
    const moduleSections = document.querySelectorAll('.module-section');
    const subTabs = document.querySelectorAll('.sub-tab');
    const plTabPanes = document.querySelectorAll('.pl-tab-pane');

    moduleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modId = btn.getAttribute('data-module');
            moduleBtns.forEach(b => b.classList.remove('active'));
            moduleSections.forEach(s => s.classList.add('hidden'));
            btn.classList.add('active');
            const mod = document.getElementById(`${modId}-module`);
            mod.classList.remove('hidden');
            
            // Auto-focus first input in the module
            const firstInp = mod.querySelector('input, textarea');
            if (firstInp) {
                firstInp.focus();
                lastFocusedInput = firstInp;
            }
        });
    });

    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const paneId = tab.getAttribute('data-pl-tab');
            subTabs.forEach(t => t.classList.remove('active'));
            plTabPanes.forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            const pane = document.getElementById(`pl-tab-${paneId}`);
            pane.classList.remove('hidden');
            
            // Auto-focus first input in the tab
            const firstInp = pane.querySelector('input, textarea');
            if (firstInp) {
                firstInp.focus();
                lastFocusedInput = firstInp;
            }
        });
    });

    // Track focused input for symbol insertion
    document.querySelectorAll('input, textarea').forEach(inp => {
        inp.addEventListener('focus', () => {
            lastFocusedInput = inp;
        });
        
        // Handle Ctrl+Enter
        inp.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                const card = inp.closest('.card');
                const solveBtn = card.querySelector('.btn-primary');
                if (solveBtn) solveBtn.click();
            }
        });
    });

    // === Theme Toggle ===
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-theme');
        themeIcon.textContent = body.classList.contains('light-theme') ? '🌙' : '☀️';
    });

    // === Symbol Toolbars ===
    document.querySelectorAll('.sym-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const sym = btn.getAttribute('data-sym');
            if (lastFocusedInput) {
                const start = lastFocusedInput.selectionStart;
                const end = lastFocusedInput.selectionEnd;
                const val = lastFocusedInput.value;
                lastFocusedInput.value = val.substring(0, start) + sym + val.substring(end);
                lastFocusedInput.focus();
                const newPos = start + sym.length;
                lastFocusedInput.setSelectionRange(newPos, newPos);
            }
        });
    });

    // === Helper: Render Output ===
    function renderOutput(containerId, content, isTable = false) {
        const container = document.getElementById(containerId);
        container.classList.remove('hidden');
        if (isTable) {
            container.innerHTML = `<div class="table-container"><table>${content}</table></div>`;
        } else {
            container.innerHTML = content;
        }
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // === 1. Truth Table Generator ===
    const ttInp = document.getElementById('tt-expr');
    const ttSolve = document.getElementById('tt-solve-btn');
    const ttOutput = document.getElementById('tt-output');

    ttSolve.addEventListener('click', () => {
        try {
            const expr = ttInp.value.trim();
            if (!expr) return;
            const tt = engine.generateTruthTable([], expr);
            
            // Determine classification
            const allTrue = tt.rows.every(r => r.conclusion);
            const allFalse = tt.rows.every(r => !r.conclusion);
            let classification = "Contingency";
            let classClass = "badge-processing"; // Default style for contingency
            let classDesc = "The expression is true for some assignments and false for others.";
            
            if (allTrue) {
                classification = "Tautology";
                classClass = "badge-success";
                classDesc = "The expression is always TRUE, regardless of variable assignments.";
            } else if (allFalse) {
                classification = "Contradiction";
                classClass = "badge-error";
                classDesc = "The expression is always FALSE, regardless of variable assignments.";
            }

            let html = `
                <div class="card" style="margin-bottom: 2rem; border-left: 5px solid var(--primary); display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                            <span class="badge ${classClass}" style="animation: none;">${classification}</span>
                            <h2 style="font-size: 1.25rem; margin: 0;">Logical Classification</h2>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">${classDesc}</p>
                    </div>
                    <div style="font-size: 2.5rem; opacity: 0.2; font-weight: 800; user-select: none;">${classification[0]}</div>
                </div>
            `;

            html += '<h3 style="margin-bottom: 1rem; color: var(--text-bright); font-size: 1.1rem;">Truth Table (T / F Form)</h3>';
            html += '<div class="table-container"><table><thead><tr>';
            
            // Header: Variables
            tt.variables.forEach(v => html += `<th class="var-col">${v}</th>`);
            
            // Header: Sub-expressions (excluding the final one which is the conclusion)
            const intermediateExprs = tt.subExpressions.filter(s => s !== tt.conclusion);
            intermediateExprs.forEach(s => html += `<th class="sub-expr-col">${s}</th>`);
            
            // Header: Final Conclusion
            html += `<th class="conclusion-col">${tt.conclusion}</th></tr></thead><tbody>`;
            
            tt.rows.forEach(row => {
                html += '<tr>';
                // Cells: Variables
                tt.variables.forEach(v => {
                    const val = row.values[v];
                    html += `<td class="${val ? 'cell-true' : 'cell-false'}">${val ? 'T' : 'F'}</td>`;
                });
                
                // Cells: Sub-expressions
                row.subExpressions.forEach(sub => {
                    if (sub.label !== tt.conclusion) {
                        html += `<td class="${sub.value ? 'cell-true' : 'cell-false'}">${sub.value ? 'T' : 'F'}</td>`;
                    }
                });
                
                // Cell: Conclusion
                html += `<td class="conclusion-col ${row.conclusion ? 'cell-true' : 'cell-false'}">${row.conclusion ? 'T' : 'F'}</td></tr>`;
            });
            html += '</tbody></table></div>';
            renderOutput('tt-output', html);
        } catch (e) {
            renderOutput('tt-output', `<div class="error-msg">✕ ${e.message}</div>`);
        }
    });

    // === 2. Expression Simplifier ===
    const simpInp = document.getElementById('simp-expr');
    const simpSolve = document.getElementById('simp-solve-btn');

    simpSolve.addEventListener('click', () => {
        try {
            const node = engine.parse(simpInp.value);
            const { result, steps } = engine.simplify(node);
            
            // Extract unique rules applied (excluding "Original")
            const rulesApplied = Array.from(new Set(steps.map(s => s.rule).filter(r => r !== 'Original')));
            
            let html = '';
            
            if (rulesApplied.length > 0) {
                html += `
                    <div style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">Rules Applied:</span>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${rulesApplied.map(r => `<span class="badge badge-processing" style="animation: none; opacity: 1;">${r}</span>`).join('')}
                        </div>
                    </div>`;
            }

            html += '<div class="explanation-steps">';
            steps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Step ${i}: ${step.rule}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; padding-left: 0.25rem;">${step.description}</p>
                        <div class="step-item">
                            <span class="step-label">Current Expression</span>
                            <span class="step-content">${step.result}</span>
                        </div>
                    </div>`;
            });
            html += `</div><div class="card" style="margin-top:2rem; border: 1px solid var(--success-bg); background: var(--success-bg); text-align: center;">
                        <label style="color: var(--success);">Final Simplified Result</label>
                        <code style="font-size:1.5rem; color:var(--success); display:block; margin-top:0.5rem; font-weight: 700;">${result}</code>
                     </div>`;
            renderOutput('simp-output', html);
        } catch (e) {
            renderOutput('simp-output', `<div class="error-msg">✕ ${e.message}</div>`);
        }
    });

    // === 3. Equivalence Checker ===
    const eqInp1 = document.getElementById('eq-expr1');
    const eqInp2 = document.getElementById('eq-expr2');
    const eqSolve = document.getElementById('eq-solve-btn');

    eqSolve.addEventListener('click', () => {
        try {
            const expr1 = eqInp1.value.trim();
            const expr2 = eqInp2.value.trim();
            if (!expr1 || !expr2) return;

            const equivalent = engine.checkEquivalence(expr1, expr2);
            
            let html = `
                <div class="card ${equivalent ? 'badge-success' : 'badge-error'}" style="text-align:center; padding:2.5rem; animation: fadeInUp 0.5s ease-out; border-radius: var(--radius-xl); margin-bottom: 2rem;">
                    <div style="font-size:3rem; margin-bottom:1rem;">${equivalent ? '≡' : '≢'}</div>
                    <h2 style="color:inherit; font-size:1.75rem; margin-bottom:1rem;">${equivalent ? 'Logically Equivalent' : 'Not Equivalent'}</h2>
                    <p style="font-size:1.1rem; opacity:0.85; max-width: 500px; margin: 0 auto;">${equivalent ? 'Both expressions produce identical truth values for all possible variable assignments.' : 'The expressions differ in at least one truth assignment.'}</p>
                </div>`;
                
            // Generate Truth Tables for comparison
            const tt1 = engine.generateTruthTable([], expr1);
            const tt2 = engine.generateTruthTable([], expr2);
            
            // Combine variables
            const vars = Array.from(new Set([...tt1.variables, ...tt2.variables])).sort();
            
            html += '<h3 style="margin-bottom: 1rem; color: var(--text-bright); font-size: 1.1rem;">Comparative Truth Table</h3>';
            html += '<div class="table-container"><table><thead><tr>';
            
            // Header: Variables
            vars.forEach(v => {
                html += `<th class="var-col">${v}</th>`;
            });
            
            // Header: Expr 1 Sub-expressions
            tt1.subExpressions.forEach(sub => {
                if (sub !== tt1.conclusion) html += `<th class="sub-expr-col" style="border-left: 2px solid var(--border);">${sub}</th>`;
            });
            
            // Header: Expr 1 Final
            html += `<th class="conclusion-col" style="border-left: 2px solid var(--border);">${expr1}</th>`;
            
            // Header: Expr 2 Sub-expressions
            tt2.subExpressions.forEach(sub => {
                if (sub !== tt2.conclusion) html += `<th class="sub-expr-col" style="border-left: 2px solid var(--border);">${sub}</th>`;
            });
            
            // Header: Expr 2 Final
            html += `<th class="conclusion-col" style="border-left: 2px solid var(--border);">${expr2}</th>`;
            
            // Header: Match?
            html += `<th class="conclusion-col" style="background: var(--surface);">Match?</th></tr></thead><tbody>`;
            
            const numRows = Math.pow(2, vars.length);
            for (let i = numRows - 1; i >= 0; i--) {
                const values = {};
                vars.forEach((v, idx) => {
                    values[v] = !!(i & (1 << (vars.length - 1 - idx)));
                });
                
                const val1 = engine.evaluate(engine.parse(expr1), values);
                const val2 = engine.evaluate(engine.parse(expr2), values);
                const match = val1 === val2;
                
                html += '<tr>';
                
                // Variables
                vars.forEach(v => {
                    const val = values[v];
                    html += `<td class="${val ? 'cell-true' : 'cell-false'}">${val ? 'T' : 'F'}</td>`;
                });
                
                // Expr 1 Sub-expressions
                tt1.subExpressions.forEach(sub => {
                    if (sub !== tt1.conclusion) {
                        const subVal = engine.evaluate(engine.parse(sub), values);
                        html += `<td style="border-left: 2px solid var(--border);" class="${subVal ? 'cell-true' : 'cell-false'}">${subVal ? 'T' : 'F'}</td>`;
                    }
                });
                
                // Expr 1 Final
                html += `<td style="border-left: 2px solid var(--border);" class="${val1 ? 'cell-true' : 'cell-false'}">${val1 ? 'T' : 'F'}</td>`;
                
                // Expr 2 Sub-expressions
                tt2.subExpressions.forEach(sub => {
                    if (sub !== tt2.conclusion) {
                        const subVal = engine.evaluate(engine.parse(sub), values);
                        html += `<td style="border-left: 2px solid var(--border);" class="${subVal ? 'cell-true' : 'cell-false'}">${subVal ? 'T' : 'F'}</td>`;
                    }
                });
                
                // Expr 2 Final
                html += `<td style="border-left: 2px solid var(--border);" class="${val2 ? 'cell-true' : 'cell-false'}">${val2 ? 'T' : 'F'}</td>`;
                
                // Match Column
                if (match) {
                     html += `<td style="background: var(--surface); color: var(--success); font-weight: bold;">Yes</td></tr>`;
                } else {
                     html += `<td style="background: var(--surface); color: var(--error); font-weight: bold;">No</td></tr>`;
                }
            }
            html += '</tbody></table></div>';

            renderOutput('eq-output', html);
        } catch (e) {
            renderOutput('eq-output', `<div class="error-msg">✕ ${e.message}</div>`);
        }
    });


    // === 4. Theorem Prover (Resolution & Tableaux) ===
    const tpPremises = document.getElementById('tp-premises');
    const tpConclusion = document.getElementById('tp-conclusion');
    const tpSolve = document.getElementById('tp-solve-btn');

    tpSolve.addEventListener('click', () => {
        try {
            const premises = tpPremises.value.split('\n').map(l => l.trim()).filter(l => l);
            const conclusion = tpConclusion.value.trim();
            if (!conclusion) throw new Error("Please enter a conclusion to prove.");

            const { proved, resolutionSteps } = engine.resolve(premises, conclusion);
            
            let html = `
                <div class="card ${proved ? 'badge-success' : 'badge-error'}" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="color:inherit; font-size:1.5rem;">${proved ? '⊢ Proved' : '⊬ Not Proved'}</h2>
                        <p style="opacity:0.8; font-size:0.9rem;">Derived using Resolution Refutation</p>
                    </div>
                    <button id="view-tree-btn" class="btn btn-secondary btn-sm">View Truth Tree (Tableaux)</button>
                </div>`;
            
            html += '<div class="explanation-steps">';
            resolutionSteps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Resolution Step ${i + 1}</h3>
                        <div class="step-item">
                            <span class="step-label">Resolve</span>
                            <div class="step-content">${step.c1} <span style="color:var(--text-muted); padding:0 0.5rem;">+</span> ${step.c2}</div>
                        </div>
                        <div class="step-item" style="border-left-color: var(--accent-cyan)">
                            <span class="step-label">Resulting Clause</span>
                            <div class="step-content" style="color:var(--primary-bright)">${step.res}</div>
                        </div>
                    </div>`;
            });
            if (resolutionSteps.length === 0 && !proved) {
                html += '<div class="card">No resolution steps could be performed. The goal might be independent of the premises.</div>';
            }
            html += '</div>';
            renderOutput('tp-output', html);

            // Setup Truth Tree Toggle
            document.getElementById('view-tree-btn').addEventListener('click', () => {
                const tableauxRoot = engine.generateTableaux(premises, conclusion);
                const treeHtml = `
                    <div class="card" style="margin-top:1.5rem; overflow:hidden;">
                        <div class="card-header">
                            <span class="ch-icon">🌲</span>
                            <h2>Semantic Tableaux (Truth Tree)</h2>
                        </div>
                        <div class="tree-wrapper">
                            ${renderTableauxHTML(tableauxRoot)}
                        </div>
                        <div class="syntax-hint" style="margin-top:1rem; text-align:center;">
                            A branch closes (✕) if it contains a literal and its negation. If all branches close, the theorem is proved.
                        </div>
                    </div>
                `;
                const treeContainer = document.createElement('div');
                treeContainer.innerHTML = treeHtml;
                document.getElementById('tp-output').appendChild(treeContainer);
                treeContainer.scrollIntoView({ behavior: 'smooth' });
            });

        } catch (e) {
            renderOutput('tp-output', `<div class="error-msg">✕ ${e.message}</div>`);
        }
    });

    function renderTableauxHTML(node) {
        let formulasHtml = node.formulas.map(f => `
            <div class="tree-formula" title="Origin: ${f.origin}">${f.node.toString()}</div>
        `).join('');

        let childrenHtml = '';
        if (node.children.length > 0) {
            childrenHtml = `
                <div class="tree-branches">
                    ${node.children.map(child => `
                        <div class="tree-branch">
                            ${renderTableauxHTML(child)}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            // Leaf node status
            const statusClass = node.closed ? 'status-closed' : 'status-open';
            const statusIcon = node.closed ? '✕' : '◯';
            const statusText = node.closed ? `Closed by ${node.closedBy[0]}, ${node.closedBy[1]}` : 'Open (Countermodel Found)';
            childrenHtml = `<div class="tree-status ${statusClass}" title="${statusText}">${statusIcon}</div>`;
        }

        return `
            <div class="tree-node-group">
                <div class="tree-labels">
                    ${formulasHtml}
                </div>
                ${childrenHtml}
            </div>
        `;
    }

    // === 5. FOL Inference Engine ===
    const folPremises = document.getElementById('fol-premises');
    const folQuery = document.getElementById('fol-query');
    const folSolve = document.getElementById('fol-solve-btn');

    folSolve.addEventListener('click', () => {
        try {
            const premises = folPremises.value.split('\n').map(l => l.trim()).filter(l => l);
            const query = folQuery.value.trim();
            if (!query) throw new Error("Please enter a query to derive.");

            const { proved, steps } = engine.folInference(premises, query);
            
            let html = `
                <div class="card ${proved ? 'badge-success' : 'badge-error'}" style="margin-bottom:1.5rem;">
                    <h2 style="color:inherit; font-size:1.5rem;">${proved ? '✓ Successfully Derived' : '✗ Could Not Derive'}</h2>
                    <p style="opacity:0.8; font-size:0.9rem;">Using Forward Chaining Inference</p>
                </div>`;
            
            html += '<div class="explanation-steps">';
            steps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Inference Step ${i + 1}: ${step.rule}</h3>
                        <div class="step-item">
                            <span class="step-label">Knowledge Base Matches</span>
                            <div class="step-content" style="font-size:0.8rem; opacity:0.8;">${step.from}</div>
                        </div>
                        <div class="step-item" style="border-left-color: var(--success)">
                            <span class="step-label">Derived Fact</span>
                            <div class="step-content" style="color:var(--success); font-weight:700;">${step.result}</div>
                        </div>
                    </div>`;
            });
            if (steps.length === 0) {
                html += `<div class="card" style="text-align:center; padding:2rem; border-style: dashed;">
                            <p style="color:var(--text-muted);">No new facts could be derived using the current rules and facts.</p>
                         </div>`;
            }
            html += '</div>';
            renderOutput('fol-output', html);
        } catch (e) {
            renderOutput('fol-output', `<div class="error-msg">✕ ${e.message}</div>`);
        }
    });

    // === Example Buttons ===
    document.getElementById('tt-eg-btn').addEventListener('click', () => { ttInp.value = '(P → Q) ∧ (Q → R)'; ttInp.focus(); });
    document.getElementById('simp-eg-btn').addEventListener('click', () => { simpInp.value = '¬(¬P ∨ ¬Q)'; simpInp.focus(); });
    document.getElementById('eq-eg-btn').addEventListener('click', () => { eqInp1.value = 'P → Q'; eqInp2.value = '¬P ∨ Q'; eqInp1.focus(); });
    document.getElementById('tp-eg-btn').addEventListener('click', () => { 
        tpPremises.value = 'P → Q\nQ → R\nP'; 
        tpConclusion.value = 'R'; 
        tpPremises.focus();
    });
    document.getElementById('fol-eg-btn').addEventListener('click', () => { 
        folPremises.value = '∀x (Human(x) → Mortal(x))\nHuman(Socrates)'; 
        folQuery.value = 'Mortal(Socrates)'; 
        folPremises.focus();
    });

    // === Clear Buttons ===
    const clearOutput = (id) => {
        const out = document.getElementById(id);
        out.classList.add('hidden');
        out.innerHTML = '';
    };

    document.getElementById('tt-clear-btn').addEventListener('click', () => { ttInp.value = ''; clearOutput('tt-output'); });
    document.getElementById('simp-clear-btn').addEventListener('click', () => { simpInp.value = ''; clearOutput('simp-output'); });
    document.getElementById('eq-clear-btn').addEventListener('click', () => { eqInp1.value = ''; eqInp2.value = ''; clearOutput('eq-output'); });
    document.getElementById('tp-clear-btn').addEventListener('click', () => { tpPremises.value = ''; tpConclusion.value = ''; clearOutput('tp-output'); });
    document.getElementById('fol-clear-btn').addEventListener('click', () => { folPremises.value = ''; folQuery.value = ''; clearOutput('fol-output'); });

    // === FOL Guide Clicks ===
    document.querySelectorAll('.guide-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const code = item.querySelector('code').textContent;
            folPremises.value += (folPremises.value ? '\n' : '') + code;
            folPremises.focus();
            lastFocusedInput = folPremises;
        });
    });

});
