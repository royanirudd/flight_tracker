const MAP_CENTER = [1.2521, 103.9198];
const map = L.map('map').setView(MAP_CENTER, 10);

const boatIcon = L.divIcon({
	html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#1976D2">
            <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
           </svg>`,
	className: 'boat-icon',
	iconSize: [24, 24],
	iconAnchor: [12, 12]
});

L.marker(MAP_CENTER, { icon: boatIcon }).addTo(map);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Create object to store markers
let flightMarkers = {};

// Create radius circles
const radiusCircles = [
	{ radius: 15000, color: '#cc0000' },  // 15
	{ radius: 30000, color: '#cc6600' },  // 30
	{ radius: 45000, color: '#007E33' },  // 45
	{ radius: 60000, color: '#0099cc' }   // 60
].map(circle => L.circle(MAP_CENTER, {
	radius: circle.radius,
	color: circle.color,
	fill: false,
	dashArray: '10, 15',
	weight: 2.5
}).addTo(map));

// Custom airplane icon
const planeIcon = L.divIcon({
	html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#2196F3">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
           </svg>`,
	className: 'plane-icon',
	iconSize: [20, 20],
	iconAnchor: [10, 10]
});

// Function to format flight information
function formatFlightInfo(flight) {
	return `
        <div class="flight-detail"><span>Callsign:</span> <span>${flight.callsign}</span></div>
        <div class="flight-detail"><span>Country:</span> <span>${flight.origin_country}</span></div>
        <div class="flight-detail"><span>Altitude:</span> <span>${flight.altitude}</span></div>
        <div class="flight-detail"><span>Speed:</span> <span>${flight.velocity}</span></div>
        <div class="flight-detail"><span>Heading:</span> <span>${flight.heading}</span></div>
        <div class="flight-detail"><span>Position:</span> <span>${flight.lat.toFixed(4)}, ${flight.lon.toFixed(4)}</span></div>
    `;
}

// Function to update weather information
async function updateWeather(lat, lon) {
	try {
		const response = await fetch(`/api/weather/?lat=${lat}&lon=${lon}`);
		const data = await response.json();

		if (data.error) {
			throw new Error(data.error);
		}

		const weatherHtml = `
            <div class="flight-detail"><span>Temperature:</span> <span>${data.temperature}</span></div>
            <div class="flight-detail"><span>Feels Like:</span> <span>${data.feels_like}</span></div>
            <div class="flight-detail"><span>Condition:</span> <span>${data.condition}</span></div>
            <div class="flight-detail"><span>Wind Speed:</span> <span>${data.wind_speed}</span></div>
            <div class="flight-detail"><span>Humidity:</span> <span>${data.humidity}</span></div>
            <div class="flight-detail"><span>Pressure:</span> <span>${data.pressure}</span></div>
        `;

		document.querySelector('.weather-data').innerHTML = weatherHtml;
		document.getElementById('weather-info').classList.remove('hidden');
	} catch (error) {
		console.error('Weather update failed:', error);
	}
}

// Function to update flight markers
async function updateFlights() {
	try {
		const response = await fetch('/api/flights/');
		const flights = await response.json();

		if (!Array.isArray(flights)) {
			throw new Error('Invalid flight data received');
		}

		// Track existing flights to remove stale markers
		const activeFlight = new Set();

		flights.forEach(flight => {
			const id = flight.callsign;
			activeFlight.add(id);

			if (flightMarkers[id]) {
				// Update existing marker position
				flightMarkers[id].setLatLng([flight.lat, flight.lon]);
				flightMarkers[id].setRotationAngle(parseFloat(flight.heading) || 0);
			} else {
				// Create new marker
				const marker = L.marker([flight.lat, flight.lon], {
					icon: planeIcon,
					rotationAngle: parseFloat(flight.heading) || 0
				}).addTo(map);

				// Add click handler
				marker.on('click', () => {
					document.getElementById('flight-info').innerHTML = formatFlightInfo(flight);
					updateWeather(flight.lat, flight.lon);
				});

				flightMarkers[id] = marker;
			}
		});

		// Remove stale markers
		Object.keys(flightMarkers).forEach(id => {
			if (!activeFlight.has(id)) {
				map.removeLayer(flightMarkers[id]);
				delete flightMarkers[id];
			}
		});

	} catch (error) {
		console.error('Flight update failed:', error);
	}
}

// Update flights every 5 seconds
setInterval(updateFlights, 5000);

// Initial update
updateFlights();

// Add CSS for plane rotation
const style = document.createElement('style');
style.textContent = `
    .plane-icon svg {
        transition: transform 0.5s ease-in-out;
    }
`;
document.head.appendChild(style);
