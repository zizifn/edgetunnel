// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { validate as uuidValidate } from 'uuid';
export function App() {
  const [text, setText] = useState('');
  function handleShare(text: string) {
    setText(text);
  }
  return (
    <div className="flex flex-col items-center h-screen">
      <Warning></Warning>
      <div className="flex flex-col h-full ite">
        <QRcodeImg text={text}></QRcodeImg>
        <Actions handleShare={handleShare}></Actions>
        <Anything handleShare={handleShare}></Anything>
      </div>
    </div>
  );
}

function QRcodeImg({ text }: { text: string }) {
  const [codeImg, setcodeImg] = useState('');
  const [copy, setCopy] = useState(false);
  useEffect(() => {
    (async () => {
      if (text) {
        const dataURL = await QRCode.toDataURL(text);
        setcodeImg(dataURL);
      }
    })();
  }, [text]);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopy(true);
    setTimeout(() => {
      setCopy(false);
    }, 1500);
  }

  return (
    <div className="flex flex-col border border-blue-300 overflow-hidden w-[420px] h-[420px] justify-start items-center">
      <img
        src={codeImg}
        width="350"
        height="350"
        alt="二维码"
        className="border-spacing-1"
      />
      <div className="flex flex-grow w-full bg-gray-200">
        <span className="flex-grow">{text}</span>
        <div className="w-6 h-6 ml-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            onClick={copyText}
            className={`w-6 h-6 hover:cursor-pointer hover:border hover:border-indigo-500 ${
              copy ? 'hidden' : 'block'
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z"
            />
          </svg>
          <svg
            aria-hidden="true"
            height="16"
            viewBox="0 0 16 16"
            version="1.1"
            className={`w-6 h-6 hover:border hover:border-indigo-500 ${
              copy ? 'block bg-green-300' : 'hidden'
            }`}
          >
            <path
              fillRule="evenodd"
              d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  );
}
function Anything({ handleShare }: { handleShare: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="mt-4">
      <label
        htmlFor="comment"
        className="block text-sm font-medium text-gray-700"
      >
        随意要分享的内容
      </label>
      <div className="mt-1">
        <textarea
          rows={4}
          name="comment"
          id="comment"
          className="block w-full border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="flex justify-end mt-2">
        <button
          onClick={() => handleShare(text)}
          type="submit"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-transparent rounded-md shadow-sm hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          分享
        </button>
      </div>
    </div>
  );
}

function Actions({ handleShare }: { handleShare: (text: string) => void }) {
  function getPageURL() {
    return window.location.href;
  }
  function getVlessURL() {
    const url = new URL(window.location.href);
    const uuid = url.pathname.split('/').find(uuidValidate);
    return `vless://${uuid}@${url.hostname}:443?encryption=none&security=tls&type=ws#deno-vless`;
  }
  return (
    <span className="inline-flex self-center mt-4 rounded-md shadow-sm isolate">
      <button
        onClick={() => handleShare(getPageURL())}
        type="button"
        className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:border-indigo-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        分享本页
      </button>
      <button
        onClick={() => handleShare(getVlessURL())}
        type="button"
        className="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        分享 V2ray
      </button>
    </span>
  );
}

function Warning() {
  return (
    <div className="flex justify-center w-full p-4 rounded-md bg-yellow-50">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon
            className="w-5 h-5 text-red-400"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">注意！！</h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>泄露本页面就等于泄露你的设置。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
