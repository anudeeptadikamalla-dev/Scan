// Global variables
let html5QrcodeScanner;
let scanning = false;
let currentScan = null;

// ---------- Utilities ----------
function formatDate(d) {
	const [y, m, day] = d.split("-");
	return `${day}-${m}-${y}`;
}

function showError(msg) {
	const box = document.getElementById('errorBox');
	box.innerText = msg;
	box.style.display = 'block';
	setTimeout(() => box.style.display = 'none', 8000);
}

// ---------- Parser ----------
function parseQRData(data) {
	const parts = data.split('-').map(s => s.trim());
	if (parts.length < 3) return null;
	const middle = parts[1];
	const mrp = parts[2];
	const firstAlphaIndex = middle.search(/[A-Za-z]/);
	let partNo = firstAlphaIndex !== -1 ? middle.slice(firstAlphaIndex) : middle.slice(8);
	return { partNo, mrp };
}

// ---------- Scanner ----------
async function startScanner() {
	if (scanning) return;
	scanning = true;
	document.getElementById('reader').style.display = 'block';
	html5QrcodeScanner = new Html5Qrcode("reader");

	try {
		await html5QrcodeScanner.start(
			{ facingMode: "environment" },
			{ fps: 10, qrbox: 250 },
			qrCodeMessage => {
				const result = parseQRData(qrCodeMessage);
				if (!result) {
					showError('Invalid QR format: ' + qrCodeMessage);
					return;
				}
				currentScan = result;
				showConfirmModal(result);
			},
			() => { }
		);
	} catch (err) {
		scanning = false;
		showError("Camera access failed: " + err);
	}
}

// ---------- Manual Add ----------
function addManualEntry() {
	const partNo = document.getElementById('manualPart').value.trim();
	const mrp = document.getElementById('manualMRP').value.trim();
	if (!partNo || !mrp) return showError("Please enter both Part No and MRP.");

	currentScan = { partNo, mrp };
	showConfirmModal(currentScan);

	// clear inputs
	document.getElementById('manualPart').value = '';
	document.getElementById('manualMRP').value = '';
}

// ---------- Confirm Modal ----------
function showConfirmModal(scan) {
	document.getElementById("confirmDetails").innerHTML =
		`<strong>Part No:</strong> ${scan.partNo}<br><strong>MRP:</strong> ₹${scan.mrp}`;
	document.getElementById("confirmModal").style.display = "flex";
}

function hideConfirmModal() {
	document.getElementById("confirmModal").style.display = "none";
}

// ---------- Save ----------
function saveScan(scan) {
	const today = new Date().toISOString().split('T')[0];
	const scans = JSON.parse(localStorage.getItem('scans') || '[]');
	const existing = scans.find(s => s.partNo === scan.partNo && s.mrp === scan.mrp && s.date === today);
	if (existing) existing.quantity += 1;
	else scans.push({ partNo: scan.partNo, mrp: scan.mrp, date: today, quantity: 1 });
	localStorage.setItem('scans', JSON.stringify(scans));
	renderHistory();
}

// ---------- Delete ----------
function deleteScan(date, partNo, mrp) {
	if (!confirm(`Delete ${partNo} (₹${mrp}) from ${formatDate(date)}?`)) return;
	let scans = JSON.parse(localStorage.getItem('scans') || '[]');
	scans = scans.filter(s => !(s.date === date && s.partNo === partNo && s.mrp === mrp));
	localStorage.setItem('scans', JSON.stringify(scans));
	renderHistory();
}

// ---------- Render ----------
function renderHistory() {
	const scans = JSON.parse(localStorage.getItem('scans') || '[]');
	const container = document.getElementById('historyContainer');
	container.innerHTML = '';

	const grouped = scans.reduce((acc, scan) => {
		if (!acc[scan.date]) acc[scan.date] = [];
		acc[scan.date].push(scan);
		return acc;
	}, {});

	const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

	dates.forEach(date => {
		const section = document.createElement('div');
		section.className = 'date-section';
		const header = document.createElement('h3');
		header.textContent = formatDate(date);
		header.style.color = "#1976d2";
		section.appendChild(header);

		const table = document.createElement('table');
		table.innerHTML = `
      <thead><tr><th>Part No</th><th>MRP</th><th>Qty</th><th>Delete</th></tr></thead>
      <tbody></tbody>`;
		let total = 0;
		const tbody = table.querySelector('tbody');

		grouped[date].forEach(scan => {
			total += parseFloat(scan.mrp) * scan.quantity;
			const row = document.createElement('tr');
			row.innerHTML = `
        <td>${scan.partNo}</td>
        <td>${scan.mrp}</td>
        <td>${scan.quantity}</td>
        <td><button class="delete-btn" onclick="deleteScan('${scan.date}','${scan.partNo}','${scan.mrp}')">🗑️</button></td>`;
			tbody.appendChild(row);
		});

		section.appendChild(table);
		const summary = document.createElement('div');
		summary.className = 'summary';
		summary.innerText = `Total Value: ₹${total.toFixed(2)}`;
		section.appendChild(summary);
		container.appendChild(section);
	});
}

// ---------- Excel Download ----------
function downloadExcel() {
	const scans = JSON.parse(localStorage.getItem('scans') || '[]');
	if (scans.length === 0) return showError('No data to export.');

	const selectedDate = document.getElementById('downloadDate').value;
	const filtered = selectedDate ? scans.filter(s => s.date === selectedDate) : scans;
	if (filtered.length === 0) return showError('No data for selected date.');

	const worksheet = XLSX.utils.json_to_sheet(filtered.map(s => ({
		Date: formatDate(s.date),
		PartNo: s.partNo,
		MRP: s.mrp,
		Quantity: s.quantity
	})));
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Scans');
	const filename = selectedDate ? `${formatDate(selectedDate)}.xlsx` : 'All-Scans.xlsx';
	XLSX.writeFile(workbook, filename);
}

// ---------- Modal Actions ----------
document.getElementById("confirmYes").addEventListener("click", async () => {
	saveScan(currentScan);
	hideConfirmModal();
	if (html5QrcodeScanner) await html5QrcodeScanner.stop();
	document.getElementById('reader').style.display = 'none';
	scanning = false;
});

document.getElementById("confirmNo").addEventListener("click", async () => {
	hideConfirmModal();
	if (html5QrcodeScanner) await html5QrcodeScanner.stop();
	document.getElementById('reader').style.display = 'none';
	scanning = false;
});

// ---------- Event Listeners ----------
document.getElementById('startBtn').addEventListener('click', startScanner);
document.getElementById('addManualBtn').addEventListener('click', addManualEntry);
document.getElementById('downloadBtn').addEventListener('click', downloadExcel);

// Initialize the app
renderHistory();
