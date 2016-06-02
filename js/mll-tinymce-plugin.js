(function($) {
    var that = null;
    tinymce.create('tinymce.plugins.mll_plugin', {
        init: function(editor, url) {
            that = this;
            that.editor = editor;
            
            editor.addButton('mll_button', {
                title: "Media Linked Library", // Tool tip
                image: url + MLL_IMAGE_BUTTON, // Image button
                cmd: 'mll_command' // command
            });

            editor.addCommand('mll_command', function() {
                var ts = new Date().getTime();
                editor.windowManager.open(
                    {
                        title: "Media Linked Library",   //    The title of the dialog window.
                        file:  url + '/mll-tinymce-dialog.html?' + ts,      //    The HTML file with the dialog contents.
                        width: 900,                               //    The width of the dialog
                        height: 550,                              //    The height of the dialog
                        inline: 1                                 //    Whether to use modal dialog instead of separate browser window.
                    }
                );
            });
      
            editor.on('DblClick', function(f) {
                if (f.target.nodeName == "IMG" && that.editor.dom.hasClass(f.target, "media_reference")) {
                    that.editor.execCommand("mll_command");
                } 
            });
            
            editor.on('ObjectResized', function(e) {
                if(e.target.nodeName == "IMG" && tinymce.activeEditor.dom.hasClass(e.target, "media_reference")) {
                    
                    var id = that.getShortcodeParam(e.target.title, 'id');
                    var path = that.getShortcodeParam(e.target.title, 'path');
                    var link = that.getShortcodeParam(e.target.title, 'link');
                    
                    var attr = { link: link, path: path, width: e.target.width, height: e.target.height };
                    
                    var s = that.buildShortcode(id, attr);
                    e.target.title = s.substring(1, s.length - 1);
                    console.log(e.target.title);
                }
                    
            });
            
            editor.on('BeforeSetContent', function(e){
                e.content = that._do_emb(e.content)
            });
                     
            editor.on('PostProcess', function(e){
                if (e.get) {
                    e.content = that._get_emb(e.content)
                }
            });
        },
        
        /**
         * When dialog is displayed, initialize its content
         */
        initDialog: function(jq_context){
            $(jq_context).focus();
            $(jq_context).keydown(function(e){
                if(e.which == 27) that.editor.windowManager.close();
            });
            
            var selectedNode = that.editor.selection.getNode();
            if (selectedNode.nodeName == "IMG" && that.editor.dom.hasClass(selectedNode, "media_reference")) {
                var media_id = that.getShortcodeParam(selectedNode.title, "id");
                var link_id = that.getShortcodeParam(selectedNode.title, "link");
                var newwindow = that.getShortcodeParam(selectedNode.title, "newwindow");
                var width = that.getShortcodeParam(selectedNode.title, "width");
                var height = that.getShortcodeParam(selectedNode.title, "height");
                
                that.showMedia( media_id , jq_context);
                
                that.MediaID(jq_context, media_id);
                that.LinkID(jq_context, link_id);
                that.LinkNewWindow(jq_context, newwindow),
                that.ImageWidth(jq_context, width);
                that.ImageHeight(jq_context, height);
            }
            
            $("form", jq_context).submit(function(event) {
                    event.preventDefault();
                    
                    var id = that.MediaID(jq_context);
                    var attr = { 
                        link: that.LinkID(jq_context),
                        newwindow: that.LinkNewWindow(jq_context),
                        width: that.ImageWidth(jq_context),
                        height: that.ImageHeight(jq_context),
                    };
                    
                    that.insertShortcode( id, attr );
            });
            
            $('#search', jq_context).keyup(function(e){ 
                var code = e.which;
                if(code==13) {
                    e.preventDefault();
                    that.searchMedia(jq_context);
                }
            });
            $('#search', jq_context).change(function(e){  that.searchMedia(jq_context); });
            
            
            
            $('#category', jq_context).change(function(){ that.searchMedia(jq_context); });
            
            $('#file', jq_context).change(function(){
                var $up = $(this);
                that.ajax_upload_media( $(this)[0].files[0], $('#upload_folder', jq_context).val(), function(response){
                    $up.val('');
                    var att_id = parseInt(response);
                    that.showMedia(att_id, jq_context);
                    that.MediaID(jq_context, att_id);
                });
            });
            
            // load categories
            that.ajax_taxonomy_get().done(function(list){
                $.each(list, function(k, o){
                    $('#category', jq_context).append($('<option>', {value: o.term_id, text: o.name }) );
                });
            });
            
            that.ajax_upload_dirs().done(function(list){
                $.each(list, function(k, v) {
                    $('#upload_folder', jq_context).append($('<option>', {value: v, text: v }));
                });
            });
        },
        
        MediaID: function(ctx, id){
            if(id == undefined)
                return $("#media_id", ctx).val();
            else 
                $("#media_id", ctx).val(id);
        },
        
        LinkID: function(ctx, id){
            if(id == undefined)
                return $("#link_id", ctx).val();
            else
                $("#link_id", ctx).val(id);
        },
        
        LinkNewWindow: function(ctx, b) {
            if(b == undefined)
                return $("#link_new", ctx).prop('checked');
            else
                $("#link_new", ctx).prop('checked', b);
        },
        
        ImageWidth: function(ctx, value) {
            if(value == undefined)
                return $("#img_width", ctx).val();
            else
                $("#img_width", ctx).val(value);
        },
        
        ImageHeight: function(ctx, value) {
            if(value == undefined)
                return $("#img_height", ctx).val();
            else
                $("#img_height", ctx).val(value);
        },
        
        showSearchResult: function(data, jq_context){
            var $mediaContainer = $('.mediaContainer', jq_context);
            $mediaContainer.html('');
            
            var container = $("<div />");
            var img = $('<span />', { class: 'mll-thumbnail' });
            var imgtext = $('<span />', { class: 'mll-imagetext' });
            var titletext  = $('<p />', {text: 'No title'});
            var mimetext = $('<div />');
            var linktext = $('<a />', { href: 'javascript:void(0)',text: 'Link with Image' });
            
            img.appendTo(container);
            imgtext.appendTo(container);
            titletext.appendTo(imgtext);
            mimetext.appendTo(imgtext);
            linktext.appendTo(imgtext);
            
            titletext.click(function(){
                var id = $(this).data('ID');
                that.MediaID(jq_context, id);
                that.showMedia(id, jq_context);
            });
            linktext.click(function(){ that.LinkID(jq_context, $(this).data('ID')) });
            
            $.each(data, function(i, row) {
                // original image size
                var imgSrc = row['path'];
                if(row.hasOwnProperty('thumbnail'))
                {
                    // if thumbnail is available, use it
                    imgSrc = row['thumbnail'];
                }
                
                if(imgSrc === undefined)
                    imgSrc = MLL_PLUGIN_URL + 'js' + MLL_IMAGE_NOTFOUND;
                else
                    imgSrc = MLL_UPLOAD_URL + imgSrc;
                                
                img.css( 'background-image', 'url('+imgSrc+')' );
                titletext.text( row['post_title'] );
                titletext.data('ID', row['ID']);
                mimetext.text(row['post_mime_type']);
                linktext.data('ID', row['ID']);
                
                $mediaContainer.append(container.clone(true));
            });
        },
        
        searchMedia: function(ctx){
            $('.mediaContainer', ctx).html('<p style="text-align: center">Loading...</p>');
            
            var search = $('#search', ctx).val();
            var category = parseInt($('#category', ctx).val());
            
            if(search.length < 3 && category <= 0) {
                $('.mediaContainer', ctx).html('<p style="text-align: center;color:red;">Please enter minimum 3 characters</p>');
                return;
            }
            
            that.ajax_search_media( search, $('#category', ctx).val() ).done(function(response){
                that.showSearchResult(response, ctx);
            });
        },
        
        showMedia: function(id, ctx){
            $('#mll-select',ctx).hide();
            $('#mll-noselect', ctx).show();
            $('#mll-noselect > p', ctx).text('Loading...');
            that.ajax_get_media(id).done(function(response){
                if(!response) {
                    $('#mll-noselect > p', ctx).text('Invalid media response from server');
                    return;
                }
                
                if(response['post_mime_type'].substring(0, 5) != 'image') {
                    $('#mll-noselect > p', ctx).text('Only images are supported');
                    return;
                }
                                
                $('#mll-select .mll-thumbnail', ctx).css('background-image', 'url('+ MLL_UPLOAD_URL + response['path'] +')');
                $('#mll-select .mll-imagetext', ctx).text(response['post_title']);
                
                $('#mll-noselect', ctx).hide();
                $('#mll-select',ctx).show();
            });
        },
               
        buildShortcode: function(id,attr){
            id = parseInt(id);
            var s = '[mediaref id=' + id;
            
            for(var key in attr){
                if(!attr.hasOwnProperty(key)) continue;
                var v = attr[key];
                if(v) s += ' ' + key + '=' + v;
            }
            s += ']';
            return s;
        },
        
        getShortcodeParam: function(s, name) {
            if(name == 'id' || name == 'link' || name == 'width' || name == 'height') {
                d = new RegExp(name + '=([0-9]+)').exec(s);
                return d ? parseInt(d[1]) : null;
            } else if(name == "newwindow") {
                d = new RegExp(name + '=(true|false)').exec(s);
                return (d != null && d[1] === 'true') ? true : false;
            } else if(name == "path") {
                d = new RegExp(name + "=\"?(.*?)\"?(\\s|$)").exec(s);
                return d ? d[1] : null;
            }
            return null;
        },
        
        insertShortcode: function(id, attr){
            that.ajax_get_media(id).done(function(response){
                attr['path'] = response['path'];
                // build the shortcode with attributes (incl. relative path)
                var shortcode = that.buildShortcode(id, attr);
                
                // replace or insert the shortcode into content editor
                that.editor.execCommand('mceInsertContent', false, shortcode);
                var all_content = that.editor.getContent();
                that.editor.setContent(all_content);
                that.editor.windowManager.close();
            });
        },
        
        /**
         * receive media information by passing its attachment_id containing: [ID, post_title, relative URL path]
         * @param {integer} id the attachment ID
         */
        ajax_get_media: function(id){
            var data = {'action': 'media_get', 'media_id': id};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * Ajax upload request using wordpress default action 'wp_handle_upload'
         * @param {File} f selected file from input tag
         * @param {function} callback on success returning the attachment id as parameter 1
         */
        ajax_upload_media: function(f, p, callback){
            var formData = new FormData();
            formData.append('action', 'wp_handle_upload');
            formData.append('file', f);
            formData.append('path', p);
            
            jQuery.ajax({
                type: 'POST',
                url: ajaxurl,
                data: formData,
                contentType: false,
                processData: false,
                success: callback
            });
        },
        
        /**
         * Ajax search request in media library
         * @param {string} filter query to search for media files
         */
        ajax_search_media: function(filter, category){
            var data = { 'action': 'media_search' };
            data['filter'] = filter;
            if(category != undefined)
                data['category'] = category;
            
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_upload_dirs: function(){
            var data = {'action': 'media_upload_dirs'};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_taxonomy_get: function() {
            var data = {'action': 'taxonomy_get'};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _do_emb:function (ed) {
            return ed.replace(/\[mediaref([^\]]*)\]/g, function (d, e) {
                var imgSrc = MLL_PLUGIN_URL + "js" + MLL_IMAGE_NOTFOUND;
                
                var p = that.getShortcodeParam(e, 'path');
                if(p != undefined)
                    imgSrc = MLL_UPLOAD_URL + p;
                
                var w = that.getShortcodeParam(e, 'width');
                var h = that.getShortcodeParam(e, 'height');
                 
                return '<img src="' + imgSrc + '" width="'+w+'" height="'+h+'" class="media_reference mceItem" title="mediaref' + tinymce.DOM.encode(e) + '" />';
            })
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _get_emb:function (b) {
            function ed(c, d) {
                d = new RegExp(d + '="([^"]+)"', "g").exec(c);
                return d ? tinymce.DOM.decode(d[1]) : "";
            }
            return b.replace(/(?:<p[^>]*>)*(<img[^>]+>)(?:<\/p>)*/g, function (e, d) {
                var c = ed(d, "class");
                if (c.indexOf("media_reference") != -1) {
                    return "<p>[" + tinymce.trim(ed(d, "title")) + "]</p>"
                }
                return e
            })
        },
        
    });

    tinymce.PluginManager.add('mll_plugin', tinymce.plugins.mll_plugin);
})(jQuery);
