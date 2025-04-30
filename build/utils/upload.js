import { unlink } from 'fs/promises';
import { upload } from '../services/qiniu';
export const uploadImageHandler = async (ctx) => {
    const files = ctx.request.files.file;
    const file = files instanceof Array ? files[0] : files;
    const filepath = file.filepath;
    const res = await upload({
        url: filepath,
        // filename: file.originalFilename!
    });
    try {
        unlink(filepath);
    }
    catch (_) { }
    if (res.status == 200 && res.data && res.data.url) {
        ctx.body = {
            code: 200,
            message: '上传成功',
            data: {
                url: res.data.url
            }
        };
    }
    else {
        ctx.body = {
            code: 100,
            message: '上传失败'
        };
    }
};
