/**
 * AI Logic Theorem Solver — UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new window.LogicEngine();

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
            document.getElementById(`${modId}-module`).classList.remove('hidden');
        });
    });

    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const paneId = tab.getAttribute('data-pl-tab');
            subTabs.forEach(t => t.classList.remove('active'));
            plTabPanes.forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`pl-tab-${paneId}`).classList.remove('hidden');
        });
    });

    // === Theme Toggle ===
    themeToggle.addEventListener('click', () => {
        const isDark = body.classList.toggle('light-theme');
        themeIcon.textContent = body.classList.contains('light-theme') ? '🌙' : '☀️';
    });

    // === Symbol Toolbars ===
    document.querySelectorAll('.sym-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sym = btn.getAttribute('data-sym');
            const targetId = btn.closest('.module-section').id === 'pl-module' 
                ? document.querySelector('.pl-tab-pane:not(.hidden) input, .pl-tab-pane:not(.hidden) textarea').id
                : 'fol-premises';
            const input = document.getElementById(targetId);
            if (input) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.substring(0, start) + sym + input.value.substring(end);
                input.focus();
                input.setSelectionRange(start + sym.length, start + sym.length);
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
            
            let html = '<thead><tr>';
            tt.variables.forEach(v => html += `<th class="var-col">${v}</th>`);
            html += `<th class="conclusion-col">${tt.conclusion}</th></tr></thead><tbody>`;
            
            tt.rows.forEach(row => {
                html += '<tr>';
                tt.variables.forEach(v => {
                    const val = row.values[v];
                    html += `<td class="${val ? 'cell-true' : 'cell-false'}">${val ? 'T' : 'F'}</td>`;
                });
                html += `<td class="conclusion-col ${row.conclusion ? 'cell-true' : 'cell-false'}">${row.conclusion ? 'T' : 'F'}</td></tr>`;
            });
            html += '</tbody>';
            renderOutput('tt-output', html, true);
        } catch (e) {
            renderOutput('tt-output', `<div class="error-msg">Error: ${e.message}</div>`);
        }
    });

    // === 2. Expression Simplifier ===
    const simpInp = document.getElementById('simp-expr');
    const simpSolve = document.getElementById('simp-solve-btn');

    simpSolve.addEventListener('click', () => {
        try {
            const node = engine.parse(simpInp.value);
            const { result, steps } = engine.simplify(node);
            
            let html = '<div class="explanation-steps">';
            steps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Step ${i}: ${step.rule}</h3>
                        <div class="step-item">
                            <span class="step-content">${step.result}</span>
                        </div>
                    </div>`;
            });
            html += `</div><div class="card" style="margin-top:1rem; border-color:var(--success);">
                        <strong>Simplified Result:</strong> <code style="font-size:1.2rem; color:var(--success);">${result}</code>
                     </div>`;
            renderOutput('simp-output', html);
        } catch (e) {
            renderOutput('simp-output', `<div class="error-msg">Error: ${e.message}</div>`);
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

            const tt1 = engine.generateTruthTable([], expr1);
            const tt2 = engine.generateTruthTable([], expr2);
            
            // Check if results match for all rows
            // Note: Simplistic check assuming same variable ordering
            const equivalent = JSON.stringify(tt1.rows.map(r => r.conclusion)) === JSON.stringify(tt2.rows.map(r => r.conclusion));
            
            const html = `
                <div class="card ${equivalent ? 'badge-success' : 'badge-error'}" style="text-align:center; padding:2rem;">
                    <h2 style="color:inherit; font-size:2rem;">${equivalent ? '≡ Equivalent' : '≢ Not Equivalent'}</h2>
                    <p>${equivalent ? 'Both expressions produce identical truth values.' : 'Expressions differ in at least one truth assignment.'}</p>
                </div>`;
            renderOutput('eq-output', html);
        } catch (e) {
            renderOutput('eq-output', `<div class="error-msg">Error: ${e.message}</div>`);
        }
    });

    // === 4. Theorem Prover (Resolution) ===
    const tpPremises = document.getElementById('tp-premises');
    const tpConclusion = document.getElementById('tp-conclusion');
    const tpSolve = document.getElementById('tp-solve-btn');

    tpSolve.addEventListener('click', () => {
        try {
            const premises = tpPremises.value.split('\n').filter(l => l.trim());
            const conclusion = tpConclusion.value.trim();
            const { proved, resolutionSteps } = engine.resolve(premises, conclusion);
            
            let html = `<div class="card ${proved ? 'badge-success' : 'badge-error'}" style="margin-bottom:1rem;">
                            <h2>${proved ? '⊢ Proved' : '⊬ Not Proved'}</h2>
                        </div>`;
            
            html += '<div class="explanation-steps">';
            resolutionSteps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Resolution Step ${i + 1}</h3>
                        <div class="step-item">
                            <span class="step-label">Combine</span>
                            <div class="step-content">${step.c1} and ${step.c2}</div>
                        </div>
                        <div class="step-item">
                            <span class="step-label">Result</span>
                            <div class="step-content" style="color:var(--primary-bright)">${step.res}</div>
                        </div>
                    </div>`;
            });
            html += '</div>';
            renderOutput('tp-output', html);
        } catch (e) {
            renderOutput('tp-output', `<div class="error-msg">Error: ${e.message}</div>`);
        }
    });

    // === 5. FOL Inference Engine ===
    const folPremises = document.getElementById('fol-premises');
    const folQuery = document.getElementById('fol-query');
    const folSolve = document.getElementById('fol-solve-btn');

    folSolve.addEventListener('click', () => {
        try {
            const premises = folPremises.value.split('\n').filter(l => l.trim());
            const query = folQuery.value.trim();
            const { proved, steps } = engine.folInference(premises, query);
            
            let html = `<div class="card ${proved ? 'badge-success' : 'badge-error'}" style="margin-bottom:1rem;">
                            <h2>${proved ? '✓ Derived' : '✗ Could Not Derive'}</h2>
                        </div>`;
            
            html += '<div class="explanation-steps">';
            steps.forEach((step, i) => {
                html += `
                    <div class="step-card">
                        <h3>Inference Step ${i + 1}: ${step.rule}</h3>
                        <div class="step-item">
                            <span class="step-label">From</span>
                            <div class="step-content">${step.from}</div>
                        </div>
                        <div class="step-item">
                            <span class="step-label">Derived Fact</span>
                            <div class="step-content" style="color:var(--primary-bright)">${step.result}</div>
                        </div>
                    </div>`;
            });
            if (steps.length === 0) {
                html += `<div class="card">No new facts could be derived using the current rules.</div>`;
            }
            html += '</div>';
            renderOutput('fol-output', html);
        } catch (e) {
            renderOutput('fol-output', `<div class="error-msg">Error: ${e.message}</div>`);
        }
    });

    // === Example Buttons ===
    document.getElementById('tt-eg-btn').addEventListener('click', () => { ttInp.value = '(P → Q) ∧ (Q → R)'; });
    document.getElementById('simp-eg-btn').addEventListener('click', () => { simpInp.value = '¬(¬P ∨ ¬Q)'; });
    document.getElementById('eq-eg-btn').addEventListener('click', () => { eqInp1.value = 'P → Q'; eqInp2.value = '¬P ∨ Q'; });
    document.getElementById('tp-eg-btn').addEventListener('click', () => { tpPremises.value = 'P → Q\nP'; tpConclusion.value = 'Q'; });
    document.getElementById('fol-eg-btn').addEventListener('click', () => { 
        folPremises.value = '∀x (Human(x) → Mortal(x))\nHuman(Socrates)'; 
        folQuery.value = 'Mortal(Socrates)'; 
    });

    // === Clear Buttons ===
    document.getElementById('tt-clear-btn').addEventListener('click', () => { ttInp.value = ''; ttOutput.classList.add('hidden'); });
    document.getElementById('simp-clear-btn').addEventListener('click', () => { simpInp.value = ''; document.getElementById('simp-output').classList.add('hidden'); });
    document.getElementById('eq-clear-btn').addEventListener('click', () => { eqInp1.value = ''; eqInp2.value = ''; document.getElementById('eq-output').classList.add('hidden'); });
    document.getElementById('tp-clear-btn').addEventListener('click', () => { tpPremises.value = ''; tpConclusion.value = ''; document.getElementById('tp-output').classList.add('hidden'); });
    document.getElementById('fol-clear-btn').addEventListener('click', () => { folPremises.value = ''; folQuery.value = ''; document.getElementById('fol-output').classList.add('hidden'); });

});
