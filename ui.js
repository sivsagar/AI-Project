/**
 * AI Logic Theorem Solver UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new window.LogicEngine();
    
    // Elements
    const premisesInput = document.getElementById('premises');
    const conclusionInput = document.getElementById('conclusion');
    const solveBtn = document.getElementById('solve-btn');
    const exampleBtn = document.getElementById('example-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    const resultSection = document.getElementById('result-section');
    const statusBadge = document.getElementById('status-badge');
    const resultTitle = document.getElementById('result-title');
    const cnfStepsContainer = document.getElementById('cnf-steps');
    const resolutionStepsContainer = document.getElementById('resolution-steps');
    const ttElement = document.getElementById('tt-element');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Examples
    const examples = [
        {
            premises: "P => Q\nP",
            conclusion: "Q",
            desc: "Modus Ponens"
        },
        {
            premises: "P => Q\n~Q",
            conclusion: "~P",
            desc: "Modus Tollens"
        },
        {
            premises: "P | Q\n~P",
            conclusion: "Q",
            desc: "Disjunctive Syllogism"
        },
        {
            premises: "R => S\nS => T",
            conclusion: "R => T",
            desc: "Hypothetical Syllogism"
        }
    ];

    let exampleIdx = 0;

    // --- Tab Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.remove('hidden');
        });
    });

    // --- Actions ---
    solveBtn.addEventListener('click', () => {
        const pLines = premisesInput.value.split('\n').filter(l => l.trim().length > 0);
        const conclusion = conclusionInput.value.trim();

        if (pLines.length === 0 || !conclusion) {
            alert("Please enter both premises and a conclusion.");
            return;
        }

        try {
            solve(pLines, conclusion);
        } catch (err) {
            alert("Error parsing logic: " + err.message);
        }
    });

    exampleBtn.addEventListener('click', () => {
        const ex = examples[exampleIdx];
        premisesInput.value = ex.premises;
        conclusionInput.value = ex.conclusion;
        exampleIdx = (exampleIdx + 1) % examples.length;
    });

    clearBtn.addEventListener('click', () => {
        premisesInput.value = '';
        conclusionInput.value = '';
        resultSection.classList.add('hidden');
    });

    function solve(premises, conclusion) {
        resultSection.classList.remove('hidden');
        statusBadge.className = 'badge badge-processing';
        statusBadge.textContent = 'Analyzing...';
        resultTitle.textContent = 'Processing logical inference...';
        
        cnfStepsContainer.innerHTML = '';
        resolutionStepsContainer.innerHTML = '';
        ttElement.innerHTML = '';

        // Capture CNF steps for each premise
        premises.forEach((p, idx) => {
            try {
                const node = engine.parse(p);
                engine.toCNF(node);
                renderCNFSteps(`Premise ${idx + 1}: ${p}`, engine.cnfSteps);
            } catch (e) {
                 console.error(e);
            }
        });

        // Conclusion negation CNF
        try {
            const negNode = engine.parse(`~(${conclusion})`);
            engine.toCNF(negNode);
            renderCNFSteps(`Negated Conclusion: ~(${conclusion})`, engine.cnfSteps);
        } catch (e) {
            console.error(e);
        }

        // Run Resolution
        const { proved, resolutionSteps } = engine.resolve(premises, conclusion);
        
        if (proved) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Proved';
            resultTitle.textContent = 'Theorem holds via contradiction (Resolution Success)';
        } else {
            statusBadge.className = 'badge badge-error';
            statusBadge.textContent = 'Not Proved';
            resultTitle.textContent = 'Resolution completed without contradiction';
        }

        resolutionSteps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = `
                <span class="step-label">Resolved ${step.c1} and ${step.c2}</span>
                <div class="step-content">Yields: ${step.res}</div>
            `;
            resolutionStepsContainer.appendChild(div);
        });

        if (resolutionSteps.length === 0) {
            resolutionStepsContainer.innerHTML = '<div class="step-item">No resolution steps possible or needed.</div>';
        }

        // Truth Table
        const tt = engine.generateTruthTable(premises, conclusion);
        renderTruthTable(tt);

        // Smooth scroll to results
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderCNFSteps(title, steps) {
        const header = document.createElement('h4');
        header.textContent = title;
        header.style.marginTop = '1rem';
        header.style.marginBottom = '0.5rem';
        header.style.color = '#fff';
        cnfStepsContainer.appendChild(header);

        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = `
                <span class="step-label">${step.label}</span>
                <div class="step-content">${step.result}</div>
            `;
            cnfStepsContainer.appendChild(div);
        });
    }

    function renderTruthTable(tt) {
        // Create header
        let headRow = '<tr>';
        tt.variables.forEach(v => headRow += `<th>${v}</th>`);
        headRow += '<th>Premises Met</th>';
        headRow += '<th>Conclusion</th>';
        headRow += '</tr>';

        // Create body
        let bodyHtml = '';
        tt.rows.forEach(row => {
            let rowHtml = '<tr>';
            tt.variables.forEach(v => {
                const val = row.values[v];
                rowHtml += `<td class="${val}">${val ? 'T' : 'F'}</td>`;
            });
            rowHtml += `<td class="${row.valid}">${row.valid ? 'T' : 'F'}</td>`;
            rowHtml += `<td class="${row.conclusion}">${row.conclusion ? 'T' : 'F'}</td>`;
            rowHtml += '</tr>';
            bodyHtml += rowHtml;
        });

        ttElement.innerHTML = `<thead>${headRow}</thead><tbody>${bodyHtml}</tbody>`;
    }
});
