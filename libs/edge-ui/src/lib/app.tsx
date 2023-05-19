// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/20/solid';
import QRCode from 'qrcode';
import { Fragment, useEffect, useState } from 'react';
import { validate as uuidValidate } from 'uuid';
import { V2Option } from './model';
export function EdgeApp() {
  const [text, setText] = useState('');
  const [show, setShow] = useState(false);
  const [v2Option, setV2Option] = useState<V2Option>({
    ws0Rtt: false,
  });
  function handleShare(text: string) {
    setText(text);
    setShow(true);
  }
  function handleV2Option(option: V2Option) {
    setV2Option(option);
  }

  useEffect(() => {
    if (show) {
      console.log('useEffect---setShow');
      const timeoutID = setTimeout(() => {
        setShow(false);
      }, 1500);
      return () => {
        clearTimeout(timeoutID);
      };
    }
  }, [show]);
  return (
    <>
      <div className="flex flex-col items-center h-screen">
        <Warning></Warning>
        <div className="flex flex-col h-full ite">
          <QRcodeImg text={text}></QRcodeImg>
          <V2Options handleV2Option={handleV2Option}></V2Options>
          <ShareActions
            handleShare={handleShare}
            v2option={v2Option}
          ></ShareActions>
          <SetUpAlert></SetUpAlert>
          <ShareAnything handleShare={handleShare}></ShareAnything>
        </div>
      </div>
      <ShareNotifications show={show} setShow={setShow}></ShareNotifications>
    </>
  );
}

function V2Options({
  handleV2Option,
}: {
  handleV2Option: (option: V2Option) => void;
}) {
  const [ws0Rtt, setWs0Rtt] = useState(false);
  return (
    <fieldset className="mt-2 border-dashed border-2 border-indigo-600">
      <legend className="sr-only">Notifications</legend>
      <div className="space-y-5">
        <div className="relative flex items-start">
          <div className="flex h-6 items-center">
            <input
              id="ws0rtt"
              aria-describedby="comments-description"
              name="ws0rtt"
              type="checkbox"
              checked={ws0Rtt}
              onChange={(event) => {
                setWs0Rtt(!ws0Rtt);
                handleV2Option({
                  ws0Rtt: !ws0Rtt,
                });
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
          </div>
          <div className="ml-3">
            <label
              htmlFor="ws0rtt"
              className="text-sm font-medium leading-6 text-gray-900"
            >
              WS 0RTT
            </label>
            <p id="comments-description" className="text-sm text-gray-500">
              Enable WS 0RTT
            </p>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function SetUpAlert() {
  return (
    <div className="p-4 rounded-md bg-yellow-50">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon
            className="w-5 h-5 text-yellow-400"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">请注意！</h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              如果遇到连不上网的情况, 请查看/参考具体客户端的 &nbsp;
              <a
                target="_blank"
                href="https://github.com/zizifn/edgetunnel#%E5%AE%A2%E6%88%B7%E7%AB%AF-v2rayn-%E9%85%8D%E7%BD%AE"
                className="font-medium text-yellow-700 underline hover:text-yellow-600"
              >
                DNS 相关设置。
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
function ShareNotifications({
  show,
  setShow,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
}) {
  return (
    <>
      {/* Global notification live region, render this permanently at the end of the document */}
      <div
        aria-live="assertive"
        className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:items-start sm:p-6"
      >
        <div className="flex flex-col items-center w-full space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition
            show={show}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="w-full max-w-sm overflow-hidden bg-white rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon
                      className="w-6 h-6 text-red-700"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      分享成功！
                    </p>
                    <p className="mt-1 text-sm text-red-500">
                      请不要随意泄露分享链接！！
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 ml-4">
                    <button
                      type="button"
                      className="inline-flex text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => {
                        setShow(false);
                      }}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
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
    <div className="flex flex-col border border-blue-300 overflow-hidden w-[500px] h-[420px] justify-start items-center">
      <img
        src={codeImg}
        width="350"
        height="350"
        alt="二维码"
        className="border-spacing-1"
      />
      <div className="flex flex-grow w-full bg-gray-200">
        <span className="flex-grow break-normal overflow-scroll w-4/5">
          {text}
        </span>
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
function ShareAnything({
  handleShare,
}: {
  handleShare: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="mt-4">
      <label
        htmlFor="comment"
        className="block text-sm font-medium text-gray-700"
      >
        随意要分享的内容.
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

function ShareActions({
  handleShare,
  v2option,
}: {
  handleShare: (text: string) => void;
  v2option: V2Option;
}) {
  function getPageURL() {
    return window.location.href;
  }
  function getVlessURL() {
    const url = new URL(window.location.href);
    const uuid = url.pathname.split('/').find(uuidValidate);
    let port = url.port;
    const isHttps = url.protocol === 'https:';
    if (!port) {
      if (isHttps) {
        port = '443';
      } else {
        port = '80';
      }
    }
    let pathParam = url.searchParams.get('wspath') || '';
    if (v2option.ws0Rtt) {
      pathParam = `${pathParam}?ed=2048`;
    }
    if (pathParam) {
      pathParam = `&path=${encodeURIComponent(pathParam)}`;
    }
    let tls = '';
    if (isHttps) {
      tls = `&security=tls&fp=randomized&sni=${url.hostname}`;
    }
    return `vless://${uuid}@${
      url.hostname
    }:${port}?encryption=none${tls}&type=ws&host=${url.hostname}${
      pathParam || ''
    }#${url.hostname}`;
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
        className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        分享 V2ray
      </button>
    </span>
  );
}

function Warning() {
  return (
    <div className="flex justify-center w-full p-4 rounded-md bg-red-50">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon
            className="w-5 h-5 text-red-700"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-700">注意！！</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>泄露本页面就等于泄露你的设置。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EdgeApp;
