import kuromoji from "kuromoji";
import Zlib from "zlibjs";
import BrowserDictionaryLoader from "kuromoji/src/loader/BrowserDictionaryLoader";

BrowserDictionaryLoader.prototype.loadArrayBuffer = (url, callback) => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  console.log(url);
  xhr.responseType = "arraybuffer";
  xhr.onload = function () {
    if (this.status > 0 && this.status !== 200) {
      callback(xhr.statusText, null);
      return;
    }
    const arraybuffer = this.response;

    try {
      const typed_array = Zlib.gunzipSync(new Uint8Array(arraybuffer));
      callback(null, typed_array.buffer);
    } catch (err) {
      callback(err, null);
      console.log(this);
      console.error(err);
    }
  };
  xhr.onerror = function (err) {
    callback(err, null);
  };
  xhr.send();
};

class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

const deferred = new Deferred();
let _tokenizer = null;
let isLoading = false;

export function getTokenizer(options = { dicPath: process.env.PUBLIC_URL + "/dict" }) {
  if (_tokenizer) {
    return Promise.resolve(_tokenizer);
  }
  if (isLoading) {
    return deferred.promise;
  }
  isLoading = true;
  // load dict
  kuromoji.builder(options).build(function (err, tokenizer) {
    if (err) {
      return deferred.reject(err);
    }
    _tokenizer = tokenizer;
    deferred.resolve(tokenizer);
  });
  return deferred.promise;
}
