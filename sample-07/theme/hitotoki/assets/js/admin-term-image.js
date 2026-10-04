// 管理画面: メニューの分類に写真を設定する（メディアライブラリから選ぶ）
;(($) => {
  'use strict'
  let frame = null

  $(document).on('click', '.hitotoki-image-field__select', function (e) {
    e.preventDefault()
    const field = $(this).closest('.hitotoki-image-field')
    frame = wp.media({ title: '分類の写真を選ぶ', button: { text: 'この写真にする' }, library: { type: 'image' }, multiple: false })
    frame.on('select', () => {
      const image = frame.state().get('selection').first().toJSON()
      const thumb = image.sizes?.thumbnail?.url || image.url
      field.find('input[type=hidden]').val(image.id)
      field.find('.hitotoki-image-field__preview').html($('<img>', { src: thumb, alt: '', width: 150 }))
      field.find('.hitotoki-image-field__remove').prop('hidden', false)
    })
    frame.open()
  })

  $(document).on('click', '.hitotoki-image-field__remove', function (e) {
    e.preventDefault()
    const field = $(this).closest('.hitotoki-image-field')
    field.find('input[type=hidden]').val('0')
    field.find('.hitotoki-image-field__preview').empty()
    $(this).prop('hidden', true)
  })

  // 分類の追加は Ajax で送られ、画面が読み込み直されないので、追加後に写真の欄を空に戻す
  $(document).ajaxComplete((event, xhr, settings) => {
    if (typeof settings.data === 'string' && settings.data.includes('action=add-tag') && !xhr.responseText.includes('wp_error')) {
      $('.hitotoki-image-field__remove').trigger('click')
    }
  })
})(jQuery)
