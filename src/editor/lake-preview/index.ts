async function toBase64URL(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.onload = async function () {
  const baseURI = await window.message.callServer('getExtensionResource', '/media/editor');
  // @ts-ignore
  const { createOpenEditor } = window.Doc;
  // 创建编辑器
  const editor = createOpenEditor(document.getElementById('root'), {
    disabledPlugins: ['save'],
    // @ts-expect-error not error
    darkMode: window.isDarkMode,
    input: {
      autoSpace: true,
    },
    codeblock: {
      codemirrorURL: baseURI + '/CodeMirror.js',
    },
    math: {
      KaTexURL: baseURI + '/katex.js',
    },
    image: {
      isCaptureImageURL() {
        return false;
      },
      async createUploadPromise(request) {
        const url = await toBase64URL(request.data);
        return {
          url,
          size: request.data.size,
          name: request.data.name,
        };
      },
    },
  });

  let cancelChangeListener = () => {};
  window.addEventListener('message', async e => {
    switch(e.data.type) {
      case 'setActive':
        editor.execCommand('focus');
        break;
      case 'undo': 
        editor.execCommand('undo');
        window.message.replayServer(e.data.requestId); 
        break;
      case 'redo':
        editor.execCommand('redo');
        window.message.replayServer(e.data.requestId);
        break;
      case 'updateContent':
        cancelChangeListener();
        editor.setDocument('text/lake', new TextDecoder().decode(e.data.data));
        // 监听内容变动
        cancelChangeListener = editor.on('contentchange', () => {
          window.message.callServer('contentchange', editor.getDocument('text/lake'));
        });
        // 获取焦点
        editor.execCommand('focus');
        window.message.replayServer(e.data.requestId);
        break;
      case 'getContent':
        window.message.replayServer(e.data.requestId, new TextEncoder().encode(editor.getDocument('text/lake')));
        break;
    }
  });

  window.message.callServer('ready');
};
