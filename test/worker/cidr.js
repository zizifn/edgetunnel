
import IPCIDR from 'ip-cidr';

const chunk = '0'.repeat(1024 * 5);
export default {
    async fetch(request, env, ctx) {
        const isin = checkIPInCIDR("192.168.1.1", "102.1.5.2/24");

            return new Response(null, {
                status: 101
            });

        
    },
};

function checkIPInCIDR(ip, cidr) {
    const cidrObject = new IPCIDR(cidr);
  
    // Check if the IP address is valid
    // if (!cidrObject.isValidAddress(ip)) {
    //   return false;
    // }
  
    // Check if the IP address is within the CIDR range
    return cidrObject.contains(ip);
  }

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}



  /**
 * Checks if an IPv4 address is within a CIDR range.
 *
 * @param {string} address The IPv4 address to check.
 * @param {string} cidr The CIDR range to check against.
 * @returns {boolean} `true` if the address is within the CIDR range, `false` otherwise.
 */
  function isIPv4InRange(address, cidr) {
	// Parse the address and CIDR range
	const addressParts = address.split('.').map(part => parseInt(part, 10));
	const [rangeAddress, rangePrefix] = cidr.split('/');
	const rangeParts = rangeAddress.split('.').map(part => parseInt(part, 10));
	const prefix = parseInt(rangePrefix, 10);

	// Convert the address and range to binary format
	const addressBinary = addressParts.reduce((acc, part) => acc + part.toString(2).padStart(8, '0'), '');
	const rangeBinary = rangeParts.reduce((acc, part) => acc + part.toString(2).padStart(8, '0'), '');

	// Compare the bits up to the prefix length
	for (let i = 0; i < prefix; i++) {
		if (addressBinary[i] !== rangeBinary[i]) {
			return false;
		}
	}

	return true;
}

/**
* Checks if an IPv6 address is within a CIDR range.
*
* @param {string} address The IPv6 address to check.
* @param {string} cidr The CIDR range to check against.
* @returns {boolean} `true` if the address is within the CIDR range, `false` otherwise.
*/
function isIPv6InRange(address, cidr) {
	// Parse the address and CIDR range
	const addressParts = address.split(':').map(part => parseInt(part, 16));
	const [rangeAddress, rangePrefix] = cidr.split('/');
	const rangeParts = rangeAddress.split(':').map(part => parseInt(part, 16));
	const prefix = parseInt(rangePrefix, 10);

	// Convert the address and range to binary format
	const addressBinary = addressParts.reduce((acc, part) => acc + part.toString(2).padStart(16, '0'), '');
	const rangeBinary = rangeParts.reduce((acc, part) => acc + part.toString(2).padStart(16, '0'), '');

	// Compare the bits up to the prefix length
	for (let i = 0; i < prefix; i++) {
		if (addressBinary[i] !== rangeBinary[i]) {
			return false;
		}
	}

	return true;
}


