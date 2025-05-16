import { unlinkSync } from "fs";
import qiniu from "qiniu";

qiniu.conf.ACCESS_KEY = "6aCSaA_wdWLuwjvqw7ozq33AsE69J4GWnZVSXZuF";
qiniu.conf.SECRET_KEY = "d0y5or3horeFQLZ_vS7XfqLplK6iNOWWQxs7G5j3";

const ACCESS_KEY = "6aCSaA_wdWLuwjvqw7ozq33AsE69J4GWnZVSXZuF";
const SECRET_KEY = "d0y5or3horeFQLZ_vS7XfqLplK6iNOWWQxs7G5j3";

const bucket = "static-dei2";

export interface UploadOptions {
  filename?: string;
  url: string;
  path?: string;
  deleteAfterDays?: number;
  // 是否删除源文件
  deleteSource?: boolean;
}

export interface UploadResponse {
  code: number;
  message?: string;
  data?: {
    [key: string]: any;
  };
}

export function upload(params: UploadOptions): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const filename = params.filename || params.url.split("/").pop();
    let key = (params.path || "tmp/") + filename || null;
    let mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
    let options = {
      scope: bucket + (key ? ":" + key : ""),
      deleteAfterDays: params.deleteAfterDays || 0,
    };

    let putPolicy = new qiniu.rs.PutPolicy(options);
    let uploadToken = putPolicy.uploadToken(mac);
    let config = new qiniu.conf.Config();
    let resumeUploader = new qiniu.resume_up.ResumeUploader(config);

    let putExtra = new qiniu.resume_up.PutExtra();
    putExtra.params = {
      "x:name": "liangqy",
      "x:age": "27",
    };
    putExtra.fname = filename;
    // putExtra.resumeRecordFile = 'progress.log'
    putExtra.progressCallback = (uploadBytes, totalBytes) => {
      // console.log('progress: ', uploadBytes + ' / ' + totalBytes, parseFloat(uploadBytes * 100 / totalBytes).toFixed(2) + '%')
      // params.progress && params.progress(uploadBytes, totalBytes)
    };

    let _url = params.url;
    // if (_url.match(/^https?:\/\//)) {
    //   _url = path.resolve(REMOTE_TMP_PATH, _url.split('?').pop() + '.vue')
    //   // _url = '/tmp/com.dei2.blue-bird/tmp/' + _url.split('?').pop() + '.vue'
    // }
    resumeUploader.putFile(
      uploadToken,
      key,
      _url,
      putExtra,
      (respErr, respBody, respInfo) => {
        if (respErr) {
          resolve({
            code: 100,
            message: respErr.message,
            data: {
              originalUrl: params.url,
            },
          });
        }

        if (respInfo.statusCode == 200) {
          if (params.deleteSource) {
            unlinkSync(params.url);
          }

          resolve({
            code: 200,
            data: {
              url:
                "https://img.liangqy.com/" + respBody.key + "?" + respBody.hash,
              originalUrl: params.url,
            },
          });
        } else {
          resolve({
            code: respInfo.statusCode,
            data: {
              ...respBody,
              originalUrl: params.url,
            },
          });
        }
      }
    );
  });
}
