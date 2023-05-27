
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